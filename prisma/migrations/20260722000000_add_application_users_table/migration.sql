-- CreateTable
CREATE TABLE "application_users" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "application_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_users_application_id_user_id_key" ON "application_users"("application_id", "user_id");

-- CreateIndex
CREATE INDEX "application_users_application_id_idx" ON "application_users"("application_id");

-- CreateIndex
CREATE INDEX "application_users_user_id_idx" ON "application_users"("user_id");

-- AddForeignKey
ALTER TABLE "application_users" ADD CONSTRAINT "application_users_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_users" ADD CONSTRAINT "application_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;