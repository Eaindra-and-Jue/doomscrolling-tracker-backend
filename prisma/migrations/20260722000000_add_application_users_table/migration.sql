-- CreateTable
CREATE TABLE "application_user" (
    "id" SERIAL NOT NULL,
    "application_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,

    CONSTRAINT "application_user_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_user_application_id_user_id_key" ON "application_user"("application_id", "user_id");

-- CreateIndex
CREATE INDEX "application_user_application_id_idx" ON "application_user"("application_id");

-- CreateIndex
CREATE INDEX "application_user_user_id_idx" ON "application_user"("user_id");

-- AddForeignKey
ALTER TABLE "application_user" ADD CONSTRAINT "application_user_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_user" ADD CONSTRAINT "application_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;