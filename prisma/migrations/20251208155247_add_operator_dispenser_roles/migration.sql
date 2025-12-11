/*
  Warnings:

  - The values [MEMBER] on the enum `MemberRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "MemberRole_new" AS ENUM ('OWNER', 'ADMIN', 'OPERATOR', 'DISPENSER');
ALTER TABLE "public"."organization_members" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "organization_members" ALTER COLUMN "role" TYPE "MemberRole_new" USING ("role"::text::"MemberRole_new");
ALTER TYPE "MemberRole" RENAME TO "MemberRole_old";
ALTER TYPE "MemberRole_new" RENAME TO "MemberRole";
DROP TYPE "public"."MemberRole_old";
ALTER TABLE "organization_members" ALTER COLUMN "role" SET DEFAULT 'DISPENSER';
COMMIT;

-- AlterTable
ALTER TABLE "organization_members" ALTER COLUMN "role" SET DEFAULT 'DISPENSER';
