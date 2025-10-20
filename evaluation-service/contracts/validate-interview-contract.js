#!/usr/bin/env node

/**
 * Script de validación de contrato API - Entrevistas
 *
 * Verifica que el contrato entre backend y frontend esté alineado
 *
 * Uso: node validate-interview-contract.js
 */

const fetch = require('node-fetch');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const TEST_APPLICATION_ID = 1;

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function validateContract() {
  log('\n=== VALIDACIÓN DE CONTRATO API - ENTREVISTAS ===\n', 'blue');

  try {
    // 1. Verificar que el backend responde
    log('1. Verificando conexión con backend...', 'yellow');
    const response = await fetch(`${BACKEND_URL}/api/interviews?applicationId=${TEST_APPLICATION_ID}`);

    if (!response.ok) {
      throw new Error(`Backend respondió con status ${response.status}`);
    }
    log('   ✓ Conexión exitosa', 'green');

    // 2. Verificar estructura de respuesta
    log('\n2. Verificando estructura de respuesta...', 'yellow');
    const data = await response.json();

    if (!data.success) {
      throw new Error('Respuesta no tiene campo "success: true"');
    }
    log('   ✓ Campo "success" presente', 'green');

    if (!Array.isArray(data.data)) {
      throw new Error('Campo "data" no es un array');
    }
    log('   ✓ Campo "data" es un array', 'green');

    if (data.data.length === 0) {
      log('   ⚠ No hay entrevistas para la aplicación de prueba', 'yellow');
      return;
    }

    log(`   ✓ Se encontraron ${data.data.length} entrevista(s)`, 'green');

    // 3. Verificar campos de cada entrevista
    log('\n3. Verificando campos de entrevistas...', 'yellow');

    const requiredFields = [
      'id',
      'applicationId',
      'interviewType',  // ← Campo crítico
      'scheduledDate',
      'scheduledTime',
      'status',
      'interviewerName',
      'studentName'
    ];

    let allFieldsPresent = true;

    for (const interview of data.data) {
      log(`\n   Entrevista ID ${interview.id}:`, 'blue');

      for (const field of requiredFields) {
        if (interview[field] === undefined || interview[field] === null) {
          log(`     ✗ Campo "${field}" faltante o nulo`, 'red');
          allFieldsPresent = false;
        } else {
          log(`     ✓ Campo "${field}": ${JSON.stringify(interview[field])}`, 'green');
        }
      }

      // 4. Verificar valores específicos
      log(`\n   Validando valores específicos:`, 'yellow');

      // Verificar que interviewType sea un valor válido
      const validInterviewTypes = ['FAMILY', 'CYCLE_DIRECTOR', 'PSYCHOLOGICAL', 'ACADEMIC'];
      if (!validInterviewTypes.includes(interview.interviewType)) {
        log(`     ✗ interviewType "${interview.interviewType}" no es válido`, 'red');
        log(`       Valores esperados: ${validInterviewTypes.join(', ')}`, 'yellow');
        allFieldsPresent = false;
      } else {
        log(`     ✓ interviewType "${interview.interviewType}" es válido`, 'green');
      }

      // Verificar formato de fecha
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(interview.scheduledDate)) {
        log(`     ✗ scheduledDate "${interview.scheduledDate}" no tiene formato YYYY-MM-DD`, 'red');
        allFieldsPresent = false;
      } else {
        log(`     ✓ scheduledDate tiene formato correcto`, 'green');
      }

      // Verificar formato de hora
      const timeRegex = /^\d{2}:\d{2}(:\d{2})?$/;
      if (!timeRegex.test(interview.scheduledTime)) {
        log(`     ✗ scheduledTime "${interview.scheduledTime}" no tiene formato HH:MM:SS`, 'red');
        allFieldsPresent = false;
      } else {
        log(`     ✓ scheduledTime tiene formato correcto`, 'green');
      }
    }

    // 5. Resumen final
    log('\n=== RESUMEN ===\n', 'blue');
    if (allFieldsPresent) {
      log('✅ CONTRATO VÁLIDO: Todos los campos requeridos están presentes y correctos', 'green');
      log('\nEl frontend debería poder mapear correctamente:', 'green');
      log('  - backendData.interviewType → frontendInterview.type', 'green');
      log('  - backendData.scheduledDate → frontendInterview.scheduledDate', 'green');
      log('  - backendData.scheduledTime → frontendInterview.scheduledTime', 'green');
    } else {
      log('❌ CONTRATO INVÁLIDO: Hay campos faltantes o con valores incorrectos', 'red');
      log('\nPor favor revise el análisis detallado arriba.', 'red');
      process.exit(1);
    }

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    log(`\nDetalles del error:`, 'yellow');
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar validación
validateContract();
