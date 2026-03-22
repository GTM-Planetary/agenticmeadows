CREATE TYPE public."InvoiceStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PAID',
    'OVERDUE',
    'VOID'
);
CREATE TYPE public."JobStatus" AS ENUM (
    'PENDING',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);
CREATE TYPE public."PhotoType" AS ENUM (
    'BEFORE',
    'AFTER',
    'MAPPING_IDEA'
);
CREATE TYPE public."QuoteStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'APPROVED',
    'REJECTED',
    'INVOICED'
);
CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'TECHNICIAN',
    'VIEWER'
);
CREATE TABLE public."Client" (
    id text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email text,
    phone text,
    company text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);
CREATE TABLE public."Invoice" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    "jobId" text,
    "quoteId" text,
    "propertyId" text,
    status public."InvoiceStatus" DEFAULT 'DRAFT'::public."InvoiceStatus" NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);
CREATE TABLE public."Job" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    "propertyId" text,
    "assignedUserId" text,
    title text NOT NULL,
    description text,
    status public."JobStatus" DEFAULT 'PENDING'::public."JobStatus" NOT NULL,
    "scheduledStart" timestamp(3) without time zone,
    "scheduledEnd" timestamp(3) without time zone,
    "isRecurring" boolean DEFAULT false NOT NULL,
    "checklistItems" jsonb,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);
CREATE TABLE public."JobPhoto" (
    id text NOT NULL,
    "jobId" text NOT NULL,
    url text NOT NULL,
    caption text,
    "photoType" public."PhotoType" DEFAULT 'BEFORE'::public."PhotoType" NOT NULL,
    "aiAnalysis" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE public."LineItem" (
    id text NOT NULL,
    "jobId" text,
    "quoteId" text,
    "invoiceId" text,
    description text NOT NULL,
    quantity double precision DEFAULT 1 NOT NULL,
    "unitPrice" double precision NOT NULL,
    CONSTRAINT lineitem_has_one_parent CHECK ((((
CASE
    WHEN ("jobId" IS NOT NULL) THEN 1
    ELSE 0
END +
CASE
    WHEN ("quoteId" IS NOT NULL) THEN 1
    ELSE 0
END) +
CASE
    WHEN ("invoiceId" IS NOT NULL) THEN 1
    ELSE 0
END) = 1))
);
CREATE TABLE public."Property" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    "streetAddress" text NOT NULL,
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,
    notes text
);
CREATE TABLE public."Quote" (
    id text NOT NULL,
    "clientId" text NOT NULL,
    "propertyId" text,
    title text NOT NULL,
    status public."QuoteStatus" DEFAULT 'DRAFT'::public."QuoteStatus" NOT NULL,
    "validUntil" timestamp(3) without time zone,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);
CREATE TABLE public."User" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    role public."UserRole" DEFAULT 'TECHNICIAN'::public."UserRole" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."JobPhoto"
    ADD CONSTRAINT "JobPhoto_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."LineItem"
    ADD CONSTRAINT "LineItem_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Property"
    ADD CONSTRAINT "Property_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_pkey" PRIMARY KEY (id);
ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);
CREATE UNIQUE INDEX "Client_email_key" ON public."Client" USING btree (email);
CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);
ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES public."Property"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Invoice"
    ADD CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."JobPhoto"
    ADD CONSTRAINT "JobPhoto_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Job"
    ADD CONSTRAINT "Job_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES public."Property"(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE ONLY public."LineItem"
    ADD CONSTRAINT "LineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES public."Invoice"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."LineItem"
    ADD CONSTRAINT "LineItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES public."Job"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."LineItem"
    ADD CONSTRAINT "LineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES public."Quote"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Property"
    ADD CONSTRAINT "Property_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;
ALTER TABLE ONLY public."Quote"
    ADD CONSTRAINT "Quote_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES public."Property"(id) ON UPDATE CASCADE ON DELETE SET NULL;
