
-- Table to log every shipment status change with timestamp
CREATE TABLE public.shipment_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
    status text NOT NULL,
    changed_at timestamp with time zone NOT NULL DEFAULT now(),
    changed_by uuid DEFAULT NULL
);

ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

-- Buyers can view history for their shipments
CREATE POLICY "Buyers can view shipment history"
ON public.shipment_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments s
        JOIN public.orders o ON o.id = s.order_id
        WHERE s.id = shipment_status_history.shipment_id
        AND o.buyer_id = auth.uid()
    )
);

-- Riders can view history for assigned shipments
CREATE POLICY "Riders can view shipment history"
ON public.shipment_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.shipments s
        WHERE s.id = shipment_status_history.shipment_id
        AND s.rider_id = auth.uid()
    )
);

-- Sellers can insert history entries
CREATE POLICY "Sellers can insert shipment history"
ON public.shipment_status_history
FOR INSERT
TO authenticated
WITH CHECK (
    has_role(auth.uid(), 'seller'::app_role) OR has_role(auth.uid(), 'logistics'::app_role)
);

-- Trigger to auto-log status changes on the shipments table
CREATE OR REPLACE FUNCTION public.log_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.shipment_status_history (shipment_id, status, changed_at)
        VALUES (NEW.id, NEW.status, now());
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_shipment_status
AFTER UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.log_shipment_status_change();

-- Also log initial status on insert
CREATE OR REPLACE FUNCTION public.log_shipment_initial_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    INSERT INTO public.shipment_status_history (shipment_id, status, changed_at)
    VALUES (NEW.id, NEW.status, NEW.created_at);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_shipment_initial_status
AFTER INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.log_shipment_initial_status();
