import {
  EXPERIMENT_READOUT_KINDS,
  EXPERIMENT_VISUALS,
  isClassifyGoal,
  isNumericThreshold,
  isPredictOutcomeGoal,
  isReachTargetStateGoal,
  type ExperimentEffect,
  type ExperimentGame,
  type ExperimentPropertyValue,
  type ExperimentTool,
  type NumericComparison,
} from "../model/experimentLab";
import type { ValidationResult } from "../model/scenario";
import { analyzeExperimentGame } from "./solveExperiment";

const KNOWN_VISUALS = new Set<string>(EXPERIMENT_VISUALS);
const KNOWN_READOUT_KINDS = new Set<string>(EXPERIMENT_READOUT_KINDS);

/**
 * Structural / referential validation for an {@link ExperimentGame}.
 *
 * This catches authoring mistakes before play: dangling references, an
 * observation id that means two different things, and — to protect the
 * "discovery before naming" principle — a concept
 * name leaking into observation text. Distinguishability (can the level actually
 * be reasoned out?) is intentionally left to {@link solveExperiment}, because it
 * is per-level and must not false-positive on reference samples like a control
 * that is deliberately indistinguishable from a solution.
 *
 * Errors are accumulated (not thrown) and named precisely so a generating agent
 * can fix each one.
 */
export function validateExperimentGame(game: ExperimentGame): ValidationResult {
  const errors: string[] = [];

  const sampleIds = new Set<string>();
  for (const sample of game.definition.samples) {
    if (sampleIds.has(sample.id)) {
      errors.push(`duplicate sample id "${sample.id}"`);
    }
    sampleIds.add(sample.id);
  }

  const toolIds = new Set<string>();
  const toolById = new Map<string, ExperimentTool>();
  for (const tool of game.definition.tools) {
    if (toolIds.has(tool.id)) {
      errors.push(`duplicate tool id "${tool.id}"`);
    }
    toolIds.add(tool.id);
    toolById.set(tool.id, tool);
  }

  const reagents = game.definition.reagents ?? [];
  const reagentIds = new Set<string>();
  for (const reagent of reagents) {
    if (reagentIds.has(reagent.id)) {
      errors.push(`duplicate reagent id "${reagent.id}"`);
    }
    if (sampleIds.has(reagent.id)) {
      errors.push(
        `reagent id "${reagent.id}" collides with a sample id; operand ids must be unambiguous`,
      );
    }
    reagentIds.add(reagent.id);
  }
  /** An operand id resolves when it names a bench sample or a shelf reagent. */
  const operandResolves = (id: string) => sampleIds.has(id) || reagentIds.has(id);

  const categoryIds = new Set<string>();
  for (const category of game.categories) {
    if (categoryIds.has(category.id)) {
      errors.push(`duplicate category id "${category.id}"`);
    }
    categoryIds.add(category.id);
  }

  const levelIds = new Set<string>();
  for (const level of game.levels) {
    if (levelIds.has(level.id)) {
      errors.push(`duplicate level id "${level.id}"`);
    }
    levelIds.add(level.id);
  }

  // Every classify sample's category must be a declared category, so the reveal
  // has a concept name to show.
  for (const sample of game.definition.samples) {
    if (!categoryIds.has(sample.categoryId)) {
      errors.push(
        `sample "${sample.id}" has categoryId "${sample.categoryId}" which is not a declared category`,
      );
    }
  }

  // Rules must reference known tools; an observation id must mean one thing.
  const observationText = new Map<string, string>();
  const recordObservation = (id: string, text: string) => {
    const prior = observationText.get(id);
    if (prior !== undefined && prior !== text) {
      errors.push(
        `observation id "${id}" is used for two different observations ("${prior}" vs "${text}"); an observation id must be stable`,
      );
    } else {
      observationText.set(id, text);
    }
  };
  // Each effect's visible payload must be well-formed: a known visual, a known
  // readout kind with a non-empty value, and a gas label only where it renders.
  const checkEffectShape = (where: string, effect: ExperimentEffect) => {
    if (!KNOWN_VISUALS.has(effect.visual)) {
      errors.push(
        `${where} has unknown visual "${effect.visual}"; expected one of ${EXPERIMENT_VISUALS.join(", ")}`,
      );
    }
    if (effect.readout) {
      if (!KNOWN_READOUT_KINDS.has(effect.readout.kind)) {
        errors.push(
          `${where} has unknown readout kind "${effect.readout.kind}"; expected one of ${EXPERIMENT_READOUT_KINDS.join(", ")}`,
        );
      }
      if (effect.readout.value.trim() === "") {
        errors.push(`${where} has a readout with an empty value`);
      }
    }
    if (effect.gasLabel !== undefined && effect.visual !== "gas") {
      errors.push(
        `${where} sets a gasLabel "${effect.gasLabel}" but its visual is "${effect.visual}", not "gas"; the label would not render`,
      );
    }
  };

  // Numeric provenance: which property names are ever a *number* — declared on a
  // sample/reagent, or written by an effect's setState/addState. A numeric
  // comparison against a property outside this set can never be satisfied, so the
  // rule is dead and is flagged below.
  const numericProps = new Set<string>();
  const noteNumericState = (
    state: Readonly<Record<string, ExperimentPropertyValue>> | undefined,
  ) => {
    if (!state) return;
    for (const key of Object.keys(state)) {
      if (typeof state[key] === "number") numericProps.add(key);
    }
  };
  const noteNumericKeys = (
    delta: Readonly<Record<string, number>> | undefined,
  ) => {
    if (!delta) return;
    for (const key of Object.keys(delta)) numericProps.add(key);
  };
  const noteEffectNumerics = (effect: ExperimentEffect) => {
    noteNumericState(effect.setState);
    noteNumericKeys(effect.addState);
    noteNumericState(effect.setOperandState);
    noteNumericKeys(effect.addOperandState);
  };
  for (const sample of game.definition.samples) noteNumericState(sample.properties);
  for (const reagent of reagents) noteNumericState(reagent.properties);
  for (const rule of game.definition.ruleSet.rules) {
    noteEffectNumerics(rule.effect);
  }
  noteEffectNumerics(game.definition.ruleSet.defaultEffect);

  // Each numeric constraint must name a producible numeric property, pick exactly
  // one right-hand side, and (for a range) not be self-contradictory.
  const checkComparisons = (
    where: string,
    map: Readonly<Record<string, NumericComparison>> | undefined,
  ) => {
    if (!map) return;
    for (const key of Object.keys(map)) {
      const cmp = map[key];
      if (!numericProps.has(key)) {
        errors.push(
          `${where} compares property "${key}" numerically, but no sample, reagent, or effect ever gives it a numeric value, so the comparison can never be satisfied`,
        );
      }
      if (isNumericThreshold(cmp)) {
        if (cmp.value === undefined && cmp.property === undefined) {
          errors.push(
            `${where} numeric comparison on "${key}" sets neither a value nor a property to compare against`,
          );
        }
        if (cmp.value !== undefined && cmp.property !== undefined) {
          errors.push(
            `${where} numeric comparison on "${key}" sets both a literal value and a property; use exactly one`,
          );
        }
        if (cmp.property !== undefined && !numericProps.has(cmp.property)) {
          errors.push(
            `${where} numeric comparison on "${key}" compares to property "${cmp.property}", which is never numeric`,
          );
        }
      } else {
        if (cmp.min === undefined && cmp.max === undefined) {
          errors.push(
            `${where} numeric range on "${key}" sets neither min nor max`,
          );
        }
        if (cmp.min !== undefined && cmp.max !== undefined && cmp.min > cmp.max) {
          errors.push(
            `${where} numeric range on "${key}" is unsatisfiable: min ${cmp.min} > max ${cmp.max}`,
          );
        }
      }
    }
  };

  for (const rule of game.definition.ruleSet.rules) {
    if (!toolIds.has(rule.toolId)) {
      errors.push(`rule references unknown tool "${rule.toolId}"`);
    }
    // A rule that constrains a second operand must be for a binary tool.
    const spec = toolById.get(rule.toolId);
    const constrainsOperand =
      rule.whenOperand !== undefined || rule.numericWhenOperand !== undefined;
    if (constrainsOperand && spec && !spec.operand) {
      errors.push(
        `rule for tool "${rule.toolId}" constrains a second operand, but that tool is not binary (it declares no operand)`,
      );
    }
    checkComparisons(
      `rule for tool "${rule.toolId}" (observation "${rule.effect.observationId}")`,
      rule.numericWhen,
    );
    checkComparisons(
      `rule for tool "${rule.toolId}" operand (observation "${rule.effect.observationId}")`,
      rule.numericWhenOperand,
    );
    recordObservation(rule.effect.observationId, rule.effect.observation);
    checkEffectShape(
      `rule for tool "${rule.toolId}" (observation "${rule.effect.observationId}")`,
      rule.effect,
    );
  }
  recordObservation(
    game.definition.ruleSet.defaultEffect.observationId,
    game.definition.ruleSet.defaultEffect.observation,
  );
  checkEffectShape("the default effect", game.definition.ruleSet.defaultEffect);

  // Discovery before naming: observation text must not state a concept name.
  const categoryLabels = game.categories.map((c) => ({
    id: c.id,
    label: c.label.toLowerCase(),
  }));
  const checkObservation = (id: string, text: string) => {
    const lowered = text.toLowerCase();
    for (const { label } of categoryLabels) {
      if (label && new RegExp(`\\b${escapeRegExp(label)}\\b`).test(lowered)) {
        errors.push(
          `observation "${id}" names the concept "${label}"; observation text must describe only what is seen, never the inference`,
        );
      }
    }
  };
  for (const rule of game.definition.ruleSet.rules) {
    checkObservation(rule.effect.observationId, rule.effect.observation);
  }
  checkObservation(
    game.definition.ruleSet.defaultEffect.observationId,
    game.definition.ruleSet.defaultEffect.observation,
  );

  // Levels: references resolve, the goal is coherent, offered tools are not inert.
  for (const level of game.levels) {
    for (const id of level.sampleIds) {
      if (!sampleIds.has(id)) {
        errors.push(`level "${level.id}" references unknown sample "${id}"`);
      }
    }
    for (const id of level.toolIds) {
      if (!toolIds.has(id)) {
        errors.push(`level "${level.id}" references unknown tool "${id}"`);
      }
    }
    // A binary tool offered in a level must have at least one valid second
    // operand available there, or it is inert and the level is unplayable.
    for (const id of level.toolIds) {
      const spec = toolById.get(id);
      if (!spec?.operand) continue;
      if (spec.operand.kind === "reagent" && reagents.length === 0) {
        errors.push(
          `level "${level.id}" offers binary tool "${id}", which needs a reagent, but the definition has no reagent shelf`,
        );
      }
      if (spec.operand.kind === "sample" && level.sampleIds.length < 2) {
        errors.push(
          `level "${level.id}" offers binary tool "${id}", which combines two samples, but fewer than two samples are on the bench`,
        );
      }
    }
    const levelSamples = new Set(level.sampleIds);
    const goal = level.goal;
    if (isClassifyGoal(goal)) {
      if (goal.classifyIds.length === 0) {
        errors.push(`level "${level.id}" is a classify level but classifies no samples`);
      }
      for (const id of goal.classifyIds) {
        if (!levelSamples.has(id)) {
          errors.push(
            `level "${level.id}" classifies sample "${id}" which is not present on the bench in that level`,
          );
        }
      }
      for (const id of goal.categoryIds) {
        if (!categoryIds.has(id)) {
          errors.push(
            `level "${level.id}" offers unknown category "${id}" as a choice`,
          );
        }
      }
    } else if (isPredictOutcomeGoal(goal)) {
      if (goal.prompts.length === 0) {
        errors.push(`level "${level.id}" is a predict-outcome level but lists no prompts`);
      }
      for (const prompt of goal.prompts) {
        if (!levelSamples.has(prompt.sampleId)) {
          errors.push(
            `level "${level.id}" prompts sample "${prompt.sampleId}" which is not present on the bench in that level`,
          );
        }
        if (!level.toolIds.includes(prompt.toolId)) {
          errors.push(
            `level "${level.id}" prompts tool "${prompt.toolId}" which is not offered in that level`,
          );
        }
        // Binary prompts must name a resolvable operand; unary prompts must not.
        const promptTool = toolById.get(prompt.toolId);
        if (promptTool?.operand) {
          if (prompt.operandId === undefined) {
            errors.push(
              `level "${level.id}" prompts binary tool "${prompt.toolId}" without an operandId`,
            );
          } else if (!operandResolves(prompt.operandId)) {
            errors.push(
              `level "${level.id}" prompts operand "${prompt.operandId}" which is neither a sample nor a shelf reagent`,
            );
          }
        } else if (prompt.operandId !== undefined) {
          errors.push(
            `level "${level.id}" prompts an operandId for unary tool "${prompt.toolId}", which takes no operand`,
          );
        }
      }
    } else if (isReachTargetStateGoal(goal)) {
      if (!levelSamples.has(goal.sampleId)) {
        errors.push(
          `level "${level.id}" targets sample "${goal.sampleId}" which is not present on the bench in that level`,
        );
      }
      if (
        Object.keys(goal.target).length === 0 &&
        Object.keys(goal.numericTarget ?? {}).length === 0
      ) {
        errors.push(`level "${level.id}" has an empty reach-target-state target`);
      }
      checkComparisons(
        `level "${level.id}" reach-target`,
        goal.numericTarget,
      );
      if (goal.targetLabel.trim() === "") {
        errors.push(`level "${level.id}" reach-target-state goal is missing a targetLabel`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * The single build-time gate for an ExperimentLab game: structural validation
 * first (referential integrity, discovery-before-naming), and only when that
 * passes, the per-level quality analysis (winnable, not brute-forceable, not
 * railed). Structural errors are primary and returned alone, mirroring
 * {@link validateSandboxLabMission}.
 */
export function validateExperimentMission(
  game: ExperimentGame,
): ValidationResult {
  const structural = validateExperimentGame(game);
  if (!structural.ok) return structural;
  return analyzeExperimentGame(game);
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
