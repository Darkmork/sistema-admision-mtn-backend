-- Script para agregar CYCLE_DIRECTOR al constraint de tipos de entrevista
-- Railway Database Update

-- Primero eliminar el constraint existente
ALTER TABLE interviews DROP CONSTRAINT IF EXISTS interviews_type_check;

-- Crear nuevo constraint con CYCLE_DIRECTOR incluido
ALTER TABLE interviews ADD CONSTRAINT interviews_type_check
CHECK (type IN ('FAMILY', 'STUDENT', 'DIRECTOR', 'PSYCHOLOGIST', 'ACADEMIC', 'CYCLE_DIRECTOR'));

-- Verificar que el constraint se creó correctamente
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'interviews'::regclass
AND conname = 'interviews_type_check';
