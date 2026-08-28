CREATE TABLE "lessonplay_game_version" (
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"version" integer NOT NULL,
	"label" text,
	"snapshot_key" text NOT NULL,
	"html_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lessonplay_game_version_thread_id_version_pk" PRIMARY KEY("thread_id","version")
);
--> statement-breakpoint
CREATE INDEX "game_version_thread_created_idx" ON "lessonplay_game_version" USING btree ("thread_id","created_at");