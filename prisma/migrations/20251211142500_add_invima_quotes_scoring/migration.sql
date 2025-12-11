-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "api_endpoint" TEXT,
ADD COLUMN     "api_key" TEXT,
ADD COLUMN     "is_external" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferred_contact" TEXT,
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsapp" TEXT;

-- CreateTable
CREATE TABLE "invima_drugs" (
    "id" TEXT NOT NULL,
    "cum" TEXT NOT NULL,
    "expediente" TEXT,
    "producto" TEXT NOT NULL,
    "titular" TEXT,
    "registro_sanitario" TEXT,
    "fecha_expedicion" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "estado_registro" TEXT,
    "consecutivo_cum" TEXT,
    "cantidad_cum" TEXT,
    "descripcion_comercial" TEXT,
    "estado_cum" TEXT,
    "fecha_activo" TIMESTAMP(3),
    "fecha_inactivo" TIMESTAMP(3),
    "muestra_medica" BOOLEAN NOT NULL DEFAULT false,
    "unidad" TEXT,
    "atc" TEXT,
    "descripcion_atc" TEXT,
    "via_administracion" TEXT,
    "concentracion" TEXT,
    "principio_activo" TEXT,
    "unidad_medida" TEXT,
    "cantidad" TEXT,
    "unidad_referencia" TEXT,
    "forma_farmaceutica" TEXT,
    "nombre_rol" TEXT,
    "tipo_rol" TEXT,
    "modalidad" TEXT,
    "ium" TEXT,

    CONSTRAINT "invima_drugs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_scores" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "price_score" INTEGER NOT NULL DEFAULT 0,
    "delivery_score" INTEGER NOT NULL DEFAULT 0,
    "payment_score" INTEGER NOT NULL DEFAULT 0,
    "discount_score" INTEGER NOT NULL DEFAULT 0,
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "tracking_score" INTEGER NOT NULL DEFAULT 0,
    "overall_score" INTEGER NOT NULL DEFAULT 0,
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "on_time_deliveries" INTEGER NOT NULL DEFAULT 0,
    "last_updated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_requests" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "request_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_request_items" (
    "id" TEXT NOT NULL,
    "quote_request_id" TEXT NOT NULL,
    "product_id" TEXT,
    "invima_drug_id" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "quote_request_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" TEXT NOT NULL,
    "quote_request_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "quote_number" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "total_amount" DECIMAL(12,2) NOT NULL,
    "delivery_days" INTEGER,
    "payment_terms" TEXT,
    "discount" DECIMAL(5,2),
    "notes" TEXT,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "quote_request_item_id" TEXT NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invima_drugs_cum_key" ON "invima_drugs"("cum");

-- CreateIndex
CREATE INDEX "invima_drugs_producto_idx" ON "invima_drugs"("producto");

-- CreateIndex
CREATE INDEX "invima_drugs_principio_activo_idx" ON "invima_drugs"("principio_activo");

-- CreateIndex
CREATE INDEX "invima_drugs_atc_idx" ON "invima_drugs"("atc");

-- CreateIndex
CREATE INDEX "invima_drugs_estado_cum_idx" ON "invima_drugs"("estado_cum");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_scores_supplier_id_key" ON "supplier_scores"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_organization_id_request_number_key" ON "quote_requests"("organization_id", "request_number");

-- AddForeignKey
ALTER TABLE "supplier_scores" ADD CONSTRAINT "supplier_scores_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_items" ADD CONSTRAINT "quote_request_items_quote_request_id_fkey" FOREIGN KEY ("quote_request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_items" ADD CONSTRAINT "quote_request_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_request_items" ADD CONSTRAINT "quote_request_items_invima_drug_id_fkey" FOREIGN KEY ("invima_drug_id") REFERENCES "invima_drugs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_quote_request_id_fkey" FOREIGN KEY ("quote_request_id") REFERENCES "quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_request_item_id_fkey" FOREIGN KEY ("quote_request_item_id") REFERENCES "quote_request_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
