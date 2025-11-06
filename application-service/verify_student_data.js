// Verify student data in Railway production database
const { Pool } = require('pg');

const verifyStudentData = async () => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const rut = '18.694.226-4';

  console.log('\n📊 VERIFICACIÓN DE DATOS PARA ESTUDIANTE RUT:', rut);
  console.log('='.repeat(70));

  try {
    // 1. Student
    console.log('\n=== ESTUDIANTE ===');
    const studentResult = await pool.query(
      'SELECT id, rut, first_name, paternal_last_name, maternal_last_name, grade_applied FROM students WHERE rut = $1',
      [rut]
    );
    if (studentResult.rows.length > 0) {
      const s = studentResult.rows[0];
      console.log(`ID: ${s.id}, RUT: ${s.rut}, Nombre: ${s.first_name} ${s.paternal_last_name} ${s.maternal_last_name}, Grado: ${s.grade_applied}`);
    } else {
      console.log('❌ No se encontró estudiante con este RUT');
      await pool.end();
      return;
    }

    // 2. Application
    console.log('\n=== APLICACIÓN ===');
    const appResult = await pool.query(
      `SELECT a.id, a.student_id, a.status, a.submission_date, a.applicant_user_id
       FROM applications a
       JOIN students s ON a.student_id = s.id
       WHERE s.rut = $1`,
      [rut]
    );
    if (appResult.rows.length > 0) {
      const a = appResult.rows[0];
      console.log(`App ID: ${a.id}, Student ID: ${a.student_id}, Status: ${a.status}, Applicant User: ${a.applicant_user_id}`);
    } else {
      console.log('No hay aplicaciones para este estudiante');
    }

    // 3. Documents
    console.log('\n=== DOCUMENTOS ===');
    const docsResult = await pool.query(
      `SELECT d.id, d.document_type, d.file_name, d.application_id
       FROM documents d
       JOIN applications a ON d.application_id = a.id
       JOIN students s ON a.student_id = s.id
       WHERE s.rut = $1`,
      [rut]
    );
    console.log(`📄 Total documentos: ${docsResult.rows.length}`);
    docsResult.rows.forEach(d => {
      console.log(`  - Doc ID: ${d.id}, Tipo: ${d.document_type}, Archivo: ${d.file_name}`);
    });

    // 4. Evaluations
    console.log('\n=== EVALUACIONES ===');
    const evalsResult = await pool.query(
      `SELECT e.id, e.evaluation_type, e.status, e.score, e.application_id
       FROM evaluations e
       JOIN applications a ON e.application_id = a.id
       JOIN students s ON a.student_id = s.id
       WHERE s.rut = $1`,
      [rut]
    );
    console.log(`📝 Total evaluaciones: ${evalsResult.rows.length}`);
    evalsResult.rows.forEach(e => {
      console.log(`  - Eval ID: ${e.id}, Tipo: ${e.evaluation_type}, Status: ${e.status}, Score: ${e.score}`);
    });

    // 5. Interviews
    console.log('\n=== ENTREVISTAS ===');
    const interviewsResult = await pool.query(
      `SELECT i.id, i.interview_type, i.scheduled_date, i.status, i.application_id
       FROM interviews i
       JOIN applications a ON i.application_id = a.id
       JOIN students s ON a.student_id = s.id
       WHERE s.rut = $1`,
      [rut]
    );
    console.log(`💬 Total entrevistas: ${interviewsResult.rows.length}`);
    interviewsResult.rows.forEach(i => {
      console.log(`  - Interview ID: ${i.id}, Tipo: ${i.interview_type}, Fecha: ${i.scheduled_date}, Status: ${i.status}`);
    });

    // 6. Interview Schedules
    console.log('\n=== HORARIOS DE ENTREVISTA ===');
    const schedulesResult = await pool.query(
      `SELECT isc.id, isc.interviewer_id, isc.date, isc.time_slot
       FROM interviewer_schedules isc
       JOIN interviews i ON isc.interview_id = i.id
       JOIN applications a ON i.application_id = a.id
       JOIN students s ON a.student_id = s.id
       WHERE s.rut = $1`,
      [rut]
    );
    console.log(`📅 Total horarios: ${schedulesResult.rows.length}`);
    schedulesResult.rows.forEach(sch => {
      console.log(`  - Schedule ID: ${sch.id}, Interviewer: ${sch.interviewer_id}, Fecha: ${sch.date}, Hora: ${sch.time_slot}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log(`✅ RESUMEN: ${docsResult.rows.length} docs, ${evalsResult.rows.length} evals, ${interviewsResult.rows.length} interviews, ${schedulesResult.rows.length} schedules`);
    console.log('='.repeat(70));

    await pool.end();
  } catch (error) {
    console.error('❌ Error verificando datos:', error.message);
    await pool.end();
    process.exit(1);
  }
};

verifyStudentData();
