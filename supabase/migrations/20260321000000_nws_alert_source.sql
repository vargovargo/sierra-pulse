-- Sierra Pulse — add NWS as an alert source
-- Enables ingest-nws to write to the alerts table.

alter type alert_source add value 'nws';
