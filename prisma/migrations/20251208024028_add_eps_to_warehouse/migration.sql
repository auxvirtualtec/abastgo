/*
  Warnings:

  - A unique constraint covering the columns `[organization_id,code]` on the table `eps` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,document_type,document_number]` on the table `patients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,code]` on the table `permissions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,code]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,order_number]` on the table `purchase_orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,code]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,transfer_number]` on the table `transfers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[organization_id,code]` on the table `warehouses` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `organization_id` to the `audit_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `deliveries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `eps` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `patients` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `pending_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `prescriptions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `products` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `purchase_orders` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `roles` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `transfers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organization_id` to the `warehouses` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- DropIndex
DROP INDEX "eps_code_key";

-- DropIndex
DROP INDEX "patients_document_type_document_number_key";

-- DropIndex
DROP INDEX "permissions_code_key";

-- DropIndex
DROP INDEX "products_code_key";

-- DropIndex
DROP INDEX "purchase_orders_order_number_key";

-- DropIndex
DROP INDEX "roles_name_key";

-- DropIndex
DROP INDEX "suppliers_code_key";

-- DropIndex
DROP INDEX "transfers_transfer_number_key";

-- DropIndex
DROP INDEX "warehouses_code_key";

-- AlterTable
ALTER TABLE "audit_logs" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN     "authorization_letter_path" TEXT,
ADD COLUMN     "authorized_doc_photo_path" TEXT,
ADD COLUMN     "authorized_person_doc" TEXT,
ADD COLUMN     "authorized_person_name" TEXT,
ADD COLUMN     "delivery_signature_path" TEXT,
ADD COLUMN     "is_authorized_pickup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "payment_amount" DECIMAL(10,2),
ADD COLUMN     "payment_method" TEXT,
ADD COLUMN     "payment_type" TEXT,
ADD COLUMN     "pending_delivery_letter_path" TEXT,
ADD COLUMN     "prescription_photo_path" TEXT;

-- AlterTable
ALTER TABLE "eps" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "document_photo_date" TIMESTAMP(3),
ADD COLUMN     "document_photo_path" TEXT,
ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "pending_items" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "organization_id" TEXT;

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN     "organization_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image" TEXT,
ALTER COLUMN "password_hash" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "eps_id" TEXT,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "report_type" TEXT,
    "query" TEXT,
    "sql_query" TEXT,
    "filters" JSONB,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_returns" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "return_number" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "return_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_return_items" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "lot_number" TEXT,
    "expiry_date" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "inventory_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_subscription_id_key" ON "organizations"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_returns_organization_id_return_number_key" ON "inventory_returns"("organization_id", "return_number");

-- CreateIndex
CREATE UNIQUE INDEX "eps_organization_id_code_key" ON "eps"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "patients_organization_id_document_type_document_number_key" ON "patients"("organization_id", "document_type", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_organization_id_code_key" ON "permissions"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_code_key" ON "products"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_organization_id_order_number_key" ON "purchase_orders"("organization_id", "order_number");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_name_key" ON "roles"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organization_id_code_key" ON "suppliers"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "transfers_organization_id_transfer_number_key" ON "transfers"("organization_id", "transfer_number");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organization_id_code_key" ON "warehouses"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_eps_id_fkey" FOREIGN KEY ("eps_id") REFERENCES "eps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eps" ADD CONSTRAINT "eps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_items" ADD CONSTRAINT "pending_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_returns" ADD CONSTRAINT "inventory_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_returns" ADD CONSTRAINT "inventory_returns_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_returns" ADD CONSTRAINT "inventory_returns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_return_items" ADD CONSTRAINT "inventory_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "inventory_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_return_items" ADD CONSTRAINT "inventory_return_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
