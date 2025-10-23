const { dbPool } = require('./src/config/database');

(async () => {
  try {
    console.log("🗑️  LIMPIEZA COMPLETA DE BASE DE DATOS RAILWAY\n");

    await dbPool.query('BEGIN');

    // 1. Eliminar evaluaciones e interviews (tienen FK a applications)
    const delEval = await dbPool.query('DELETE FROM evaluations RETURNING id');
    console.log(`✅ Evaluaciones eliminadas: ${delEval.rowCount}`);

    const delInt = await dbPool.query('DELETE FROM interviews RETURNING id');
    console.log(`✅ Entrevistas eliminadas: ${delInt.rowCount}`);

    // 2. Eliminar documentos (tiene FK a applications)
    const delDocs = await dbPool.query('DELETE FROM documents RETURNING id');
    console.log(`✅ Documentos eliminados: ${delDocs.rowCount}`);

    // 3. Eliminar formularios complementarios
    const delForms = await dbPool.query('DELETE FROM complementary_application_forms RETURNING id');
    console.log(`✅ Formularios complementarios eliminados: ${delForms.rowCount}`);

    // 4. Eliminar aplicaciones
    const delApps = await dbPool.query('DELETE FROM applications RETURNING id');
    console.log(`✅ Aplicaciones eliminadas: ${delApps.rowCount}`);

    // 5. Eliminar estudiantes
    const delStudents = await dbPool.query('DELETE FROM students RETURNING id');
    console.log(`✅ Estudiantes eliminados: ${delStudents.rowCount}`);

    // 6. Eliminar padres
    const delParents = await dbPool.query('DELETE FROM parents RETURNING id');
    console.log(`✅ Padres eliminados: ${delParents.rowCount}`);

    // 7. Eliminar guardianes
    const delGuardians = await dbPool.query('DELETE FROM guardians RETURNING id');
    console.log(`✅ Guardianes eliminados: ${delGuardians.rowCount}`);

    // 8. Eliminar sostenedores (supporters)
    const delSupp = await dbPool.query('DELETE FROM supporters RETURNING id');
    console.log(`✅ Sostenedores eliminados: ${delSupp.rowCount}`);

    // 9. Eliminar usuarios NO ADMIN
    const delUsers = await dbPool.query("DELETE FROM users WHERE role != 'ADMIN' RETURNING id, email");
    console.log(`✅ Usuarios NO-ADMIN eliminados: ${delUsers.rowCount}`);
    if (delUsers.rowCount > 0) {
      delUsers.rows.forEach(u => console.log(`   - ${u.email}`));
    }

    // 10. Resetear secuencias
    await dbPool.query("ALTER SEQUENCE documents_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE complementary_application_forms_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE applications_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE evaluations_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE interviews_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE students_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE parents_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE guardians_id_seq RESTART WITH 1");
    await dbPool.query("ALTER SEQUENCE supporters_id_seq RESTART WITH 1");
    console.log("✅ Secuencias reseteadas");

    await dbPool.query('COMMIT');

    console.log("\n✅ LIMPIEZA COMPLETADA EXITOSAMENTE!\n");

    // Verificar lo que quedó
    console.log("📊 VERIFICACIÓN FINAL:");
    const docs = await dbPool.query("SELECT COUNT(*) FROM documents");
    const apps = await dbPool.query("SELECT COUNT(*) FROM applications");
    const students = await dbPool.query("SELECT COUNT(*) FROM students");
    const users = await dbPool.query("SELECT COUNT(*) FROM users");
    const admins = await dbPool.query("SELECT COUNT(*) FROM users WHERE role = 'ADMIN'");

    console.log(`  Documentos: ${docs.rows[0].count}`);
    console.log(`  Aplicaciones: ${apps.rows[0].count}`);
    console.log(`  Estudiantes: ${students.rows[0].count}`);
    console.log(`  Usuarios totales: ${users.rows[0].count}`);
    console.log(`  Usuarios ADMIN: ${admins.rows[0].count}\n`);

    // Mostrar los ADMIN que quedaron
    const adminList = await dbPool.query("SELECT id, email, first_name, last_name FROM users WHERE role = 'ADMIN' ORDER BY id");
    console.log("👤 USUARIOS ADMIN PRESERVADOS:");
    adminList.rows.forEach(a => {
      console.log(`  - ID: ${a.id} | ${a.email} | ${a.first_name} ${a.last_name}`);
    });

    await dbPool.end();
  } catch (error) {
    await dbPool.query('ROLLBACK');
    console.error("\n❌ Error durante la limpieza:", error.message);
    console.error(error);
    await dbPool.end();
    process.exit(1);
  }
})();
