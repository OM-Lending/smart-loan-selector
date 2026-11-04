BEGIN;

-- CreateEnum
CREATE TYPE "BrokerEnquiryStatus" AS ENUM ('NEW', 'CONTACTING', 'CONVERTED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "EnquiryActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'CONTACT_ATTEMPT', 'NOTE_ADDED', 'ASSIGNED');

-- CreateEnum
CREATE TYPE "EnquiryContactChannel" AS ENUM ('PHONE', 'EMAIL', 'OTHER');

-- CreateEnum
CREATE TYPE "EnquiryContactOutcome" AS ENUM ('REACHED', 'NO_ANSWER', 'VOICEMAIL_LEFT', 'MESSAGE_SENT', 'INVALID_CONTACT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('APPLICATION_CREATED', 'APPLICATION_SUBMITTED', 'BROKER_ENQUIRY_CREATED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "broker_enquiries" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "request_ip_hash" CHAR(64) NOT NULL,
    "user_id" UUID,
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(24) NOT NULL,
    "message" VARCHAR(4000) NOT NULL,
    "status" "BrokerEnquiryStatus" NOT NULL DEFAULT 'NEW',
    "assigned_to_id" UUID,
    "linked_application_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broker_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_enquiry_activities" (
    "id" UUID NOT NULL,
    "enquiry_id" UUID NOT NULL,
    "actor_id" UUID,
    "type" "EnquiryActivityType" NOT NULL,
    "channel" "EnquiryContactChannel",
    "outcome" "EnquiryContactOutcome",
    "from_status" "BrokerEnquiryStatus",
    "to_status" "BrokerEnquiryStatus",
    "note" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_enquiry_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" UUID NOT NULL,
    "event_key" VARCHAR(200) NOT NULL,
    "environment" VARCHAR(20) NOT NULL,
    "type" "NotificationType" NOT NULL,
    "application_id" UUID,
    "enquiry_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "recipient_email" VARCHAR(254) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "lock_token" UUID,
    "locked_until" TIMESTAMP(3),
    "provider_message_id" VARCHAR(254),
    "last_error" VARCHAR(500),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broker_enquiries_request_id_key" ON "broker_enquiries"("request_id");

-- CreateIndex
CREATE INDEX "broker_enquiries_status_created_at_idx" ON "broker_enquiries"("status", "created_at");

-- CreateIndex
CREATE INDEX "broker_enquiries_email_created_at_idx" ON "broker_enquiries"("email", "created_at");

-- CreateIndex
CREATE INDEX "broker_enquiries_request_ip_hash_created_at_idx" ON "broker_enquiries"("request_ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "broker_enquiries_assigned_to_id_idx" ON "broker_enquiries"("assigned_to_id");

-- CreateIndex
CREATE INDEX "broker_enquiries_user_id_idx" ON "broker_enquiries"("user_id");

-- CreateIndex
CREATE INDEX "broker_enquiries_linked_application_id_idx" ON "broker_enquiries"("linked_application_id");

-- CreateIndex
CREATE INDEX "broker_enquiry_activities_enquiry_id_created_at_idx" ON "broker_enquiry_activities"("enquiry_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_events_event_key_key" ON "notification_events"("event_key");

-- CreateIndex
CREATE INDEX "notification_events_environment_created_at_idx" ON "notification_events"("environment", "created_at");

-- CreateIndex
CREATE INDEX "notification_events_application_id_idx" ON "notification_events"("application_id");

-- CreateIndex
CREATE INDEX "notification_events_enquiry_id_idx" ON "notification_events"("enquiry_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_next_attempt_at_idx" ON "notification_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_event_id_recipient_email_key" ON "notification_deliveries"("event_id", "recipient_email");

-- AddForeignKey
ALTER TABLE "broker_enquiries" ADD CONSTRAINT "broker_enquiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_enquiries" ADD CONSTRAINT "broker_enquiries_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_enquiries" ADD CONSTRAINT "broker_enquiries_linked_application_id_fkey" FOREIGN KEY ("linked_application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_enquiry_activities" ADD CONSTRAINT "broker_enquiry_activities_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "broker_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "broker_enquiry_activities" ADD CONSTRAINT "broker_enquiry_activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_enquiry_id_fkey" FOREIGN KEY ("enquiry_id") REFERENCES "broker_enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "notification_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep malformed workflow/source rows out even when writing outside the API.
ALTER TABLE "broker_enquiries" ADD CONSTRAINT "broker_enquiries_contact_check" CHECK (
  char_length(btrim("full_name")) >= 2 AND char_length(btrim("message")) >= 10
);
ALTER TABLE "broker_enquiries" ADD CONSTRAINT "broker_enquiries_conversion_check" CHECK (
  "status" <> 'CONVERTED' OR "linked_application_id" IS NOT NULL
);
ALTER TABLE "broker_enquiry_activities" ADD CONSTRAINT "enquiry_contact_result_check" CHECK (
  ("type" = 'CONTACT_ATTEMPT' AND "channel" IS NOT NULL AND "outcome" IS NOT NULL)
  OR ("type" <> 'CONTACT_ATTEMPT' AND "channel" IS NULL AND "outcome" IS NULL)
);
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_event_source_check" CHECK (
  ("type" = 'BROKER_ENQUIRY_CREATED' AND "enquiry_id" IS NOT NULL AND "application_id" IS NULL)
  OR ("type" IN ('APPLICATION_CREATED', 'APPLICATION_SUBMITTED') AND "application_id" IS NOT NULL AND "enquiry_id" IS NULL)
);
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_environment_check" CHECK (
  "environment" IN ('production', 'preview', 'development')
);
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_delivery_attempt_check" CHECK ("attempt_count" >= 0);
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_delivery_lease_check" CHECK (
  ("status" = 'PROCESSING' AND "lock_token" IS NOT NULL AND "locked_until" IS NOT NULL)
  OR ("status" <> 'PROCESSING' AND "lock_token" IS NULL AND "locked_until" IS NULL)
);
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_delivery_sent_check" CHECK (
  ("status" = 'SENT' AND "sent_at" IS NOT NULL) OR ("status" <> 'SENT' AND "sent_at" IS NULL)
);

-- Clerk authorization is checked in server routes. Browser Supabase roles have
-- no policies on these tables; the privileged server connection handles access.
ALTER TABLE "broker_enquiries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "broker_enquiry_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_deliveries" ENABLE ROW LEVEL SECURITY;

COMMIT;
