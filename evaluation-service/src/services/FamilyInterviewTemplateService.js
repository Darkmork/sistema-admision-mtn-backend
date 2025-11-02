const logger = require('../utils/logger');

/**
 * Embedded family interview template data
 * This template is embedded directly in the code to avoid filesystem dependencies in Docker containers
 * Original source: ENTREVISTA_FAMILIAS_2026_COMPLETO.json
 * Last verified: 2025-11-02 - Fixed JSON syntax error (line 287: } → ])
 */
const INTERVIEW_TEMPLATE = {"metadata":{"title":"Entrevista a Familias Nuevas - Formulario Completo 2026","description":"Cuestionario de evaluación individual para entrevistadores","maxScore":40,"sections":[{"id":1,"name":"Familia y Educación de los Hijos","maxScore":18},{"id":2,"name":"Hijo/a que Postula","maxScore":10},{"id":3,"name":"Espiritualidad","maxScore":6},{"id":4,"name":"Responsabilidad por la Sociedad","maxScore":6}]},"sections":{"section1":{"id":1,"title":"I. FAMILIA Y EDUCACIÓN DE LOS HIJOS","maxScore":18,"questions":{"q1":{"id":"1.1","number":1,"title":"Motivos de postulación al MTN","focus":"Indagar sobre las razones que los motivan a postular al MTN, percibir la coherencia que tiene con el PEI.","applicableTo":"ALL_LEVELS","rubric":{"1":{"score":1,"description":"Cerca de la casa, se cambiaron a este barrio, buenos resultados académicos, conocemos alumnos o ex alumnos y nos gusta como son, es el colegio de los primos. (al menos 2 indicadores en esta línea o uno del punto 2)"},"2":{"score":2,"description":"Que sea un colegio familiar, innovación pedagógica, que sea dual, coeducacional, inclusión, católico, que sea de Schoenstatt. (al menos 2 en esta línea o un indicador del punto 3)"},"3":{"score":3,"description":"Originalidad, importancia de los vínculos, responsabilidad social, respeto, sencillez, unidad familiar. (al menos 3 indicadores de este punto o dos de este punto y uno del dos)."}}},"q2_prekinder_2basico":{"id":"1.2a","number":2,"title":"Valores familiares","question":"Pensando en la educación de sus hijos, ¿qué es lo que más valoran de sus familias de origen y qué es lo que no les gustó?","applicableTo":"PREKINDER_2BASICO","focus":"Indagar valores familiares y proyecto familiar.","rubric":{"1":{"score":1,"description":"Identifican los valores de su familia de origen, no se percibe un proyecto común."},"2":{"score":2,"description":"Identifican los valores de su familia de origen y han definido valores comunes."},"3":{"score":3,"description":"Adhieren a varios valores y se ven en cosas concretas. Entre estos: familia, solidaridad, sencillez, respeto, verdad, compromiso, amor, responsabilidad, alegría, libertad. (al menos 3 indicadores)."}}},"q2_3basico_4medio":{"id":"1.2b","number":2,"title":"Valores familiares","question":"Pensando en la educación de sus hijos, ¿qué valores familiares han intencionado? ¿Cómo lo han hecho? ¿Cómo ha logrado incorporar a todos los hijos?","applicableTo":"3BASICO_4MEDIO","focus":"Indagar valores familiares y proyecto familiar.","rubric":{"1":{"score":1,"description":"Identifican los valores importantes para su familia (familia, solidaridad, sencillez, respeto, verdad, compromiso, amor, responsabilidad, alegría, libertad, etc.)"},"2":{"score":2,"description":"Se reconocen acciones concretas que plasman esos valores"},"3":{"score":3,"description":"Logran incorporar e integrar los valores a los que adhieren en la vida familiar, y logran incluir a todos los miembros de la familia"}}},"q3_prekinder_4basico":{"id":"1.3a","number":3,"title":"Hábitos, normas y límites","question":"Pensando en la educación de sus hijos, ¿Cómo trabajan los hábitos y normas en su familia?","applicableTo":"PREKINDER_4BASICO","focus":"Indagar sobre el estilo parental y el comportamiento de los niños.","rubric":{"1":{"score":1,"description":"• No tiene rutinas y normas claras, no se percibe autoridad en los padres y el niño(a) es quien manda.\n• Tiene reglas claras, pero se aplican de forma autoritaria y rígida."},"2":{"score":2,"description":"La rutina tiene reglas claras, pero en la práctica la implementación no facilita la autonomía."},"3":{"score":3,"description":"Tiene normas claras que se aplican con firmeza y afecto, fomentando la adquisición autónoma de la regla y da una seguridad básica."}}},"q3_5basico_3medio":{"id":"1.3b","number":3,"title":"Hábitos, normas y límites","question":"Pensando en la educación de sus hijos, ¿Qué límites y/o responsabilidades han establecido en ellos?","applicableTo":"5BASICO_3MEDIO","focus":"Indagar sobre el estilo parental y el comportamiento de los niños.","rubric":{"1":{"score":1,"description":"No se observan límites y/o responsabilidades en los hijos"},"2":{"score":2,"description":"Se observan límites y/o responsabilidades, pero en la práctica; no hay seguimiento o consistencia con ellas. O se observa desacuerdo entre los padres"},"3":{"score":3,"description":"Se observan límites y responsabilidades claras que ayudan a sus hijos a hacerse cargo de sus acciones"}}}}},"section2":{"id":2,"title":"II. HIJO/A QUE POSTULA","maxScore":10,"questions":{"q1":{"id":"2.1","number":1,"title":"Fortalezas del hijo/a","question":"De las fortalezas de tu hijo/a: ¿qué te gustaría que se mantuviera en el tiempo y por qué? ¿Qué podrían ustedes hacer para desarrollar este aspecto?","applicableTo":"ALL_LEVELS","focus":"Indagar las fortalezas que mencionaron en el cuestionario.","rubric":{"1":{"score":1,"description":"La respuesta es vaga, no queda claro cual es el aporte concreto que su hijo/a hace a la familia y que les trae alegría. (Ej. Se refiere solamente a que es generoso)."},"2":{"score":2,"description":"Describen el aporte que su hijo/a hace a la familia, da algunos ejemplos que lo caracterizan actualmente. (Ej. Se refiere a que es generoso y las acciones con las cuales les muestra su generosidad y esto aporta alegría a su familia)."},"3":{"score":3,"description":"Desarrollan con claridad los aspectos en que su hijo/a aporta alegría a la familia, con ejemplos concretos y la forma en que lo/a ayudan a desarrollarlo. Logran proyectar a su hijo con su originalidad en ejemplos concretos como un aporte a la sociedad."}}},"q2":{"id":"2.2","number":2,"title":"Frustración y reacciones","questions":["¿Cuáles son las cosas que más le duelen o le frustran a tu hijo/hija?","¿Cómo reacciona cuando las cosas no le resultan como él/ella quiere?"],"applicableTo":"ALL_LEVELS","focus":"Conocimiento del hijo/a y manejo de la frustración","rubric":{"1":{"score":1,"description":"Conoce a su hijo/hija e identifica las formas que tiene de reaccionar frente a la frustración o a las cosas que le cuestan."},"2":{"score":2,"description":"Conoce a su hijo/hija e identifica las formas cómo reacciona frente a las cosas que le cuestan, que no le resultan o le producen frustración y muestra cómo lo han ayudado/apoyado en el proceso."}}}}},"section3":{"id":3,"title":"III. ESPIRITUALIDAD","maxScore":6,"questions":{"q1":{"id":"3.1","number":1,"title":"Educación en la fe","question":"¿Qué hacen para educar a sus hijos en la fe?","applicableTo":"ALL_LEVELS","focus":"Indagar la respuesta del cuestionario. ¿Qué experiencias de fe tienen como familia? Se trata de averiguar qué hacen actualmente como familia, y con sus hijos en la vida de fe. Es una pregunta de familia, por eso el puntaje 3 discrimina en la profundidad de la familia. Nos interesa tener familias comprometidas con la fe, que serán un aporte a la comunidad del colegio.\n\nAveriguar sobre la profundidad de la/s experiencia/s de fe. Es común que las experiencias de fe se hayan vivido en las familias de origen, el colegio o la universidad y ahora no puedan hacerlo por los niños. Pero marcaron su vida y hay un anhelo de hacerlo en el futuro porque para ellos fue importante.","rubric":{"1":{"score":1,"description":"Existen algunas instancias o espacios de oración personal y/o con los hijos.\nPor ejemplo: rezan en la noche, dan gracias y piden por lo que necesitan. Se refieren a actividades formales como ir a misa, rezar el mes de María, la misa de Navidad, participación en la Semana Santa, etc."},"2":{"score":2,"description":"Existe la idea de transmitir la espiritualidad a los hijos desde que son chicos. Hay un claro camino de desarrollo espiritual en ellos como padres o familia.\nPor ejemplo: Leen con los niños cuentos con valores o historias religiosas, reflexionando sobre su contenido. Comparten vivencias, experiencias, tradiciones religiosas concretas o celebraciones litúrgicas.\nManifiestan el sentido de su participación, por ejemplo: participar en el mes de Maria me acerca a la Virgen, ir a misa al Cerro Manquehue es una forma de hacer un paseo y mostrar la fe a sus hijos, vivir alguna fiesta religiosa o ir a la procesión de la Virgen del Carmen enseña a los niños sobre la patrona de Chile. (acción más sentido)"},"3":{"score":3,"description":"Tienen un camino de desarrollo espiritual familiar claro y profundo. Buscan activamente formas y espacios para transmitirlo a sus hijos, o para vivirlo en familia.\nPor ejemplo: oración profunda de agradecimiento, petición y meditación de la vida diaria o de la palabra de Dios. Familias que rezan en un altar familiar, santuario hogar, lugares religiosos.\nParticipan en parroquias o movimientos de iglesia, como: Sch, alianza, grupos pastorales, taller de perdón, lexio, ejercicios espirituales, retiros, CAE, CLP u otros.\nTambién puede ser familias que muestran un anhelo profundo de vivir en concordancia con la fe o de crecimiento personal y familiar en la fe.\nPor ej: quienes dicen que los ha marcado la situación de la iglesia hoy, pero buscan a Cristo, quieren comprometerse a hacer un aporte nuevo. Hay algunos que no han tenido experiencias significativas, pero les gustaría crecer en ese aspecto. Para quienes es importante crecer en coherencia, etc"}}}}},"section4":{"id":4,"title":"IV. RESPONSABILIDAD POR LA SOCIEDAD","maxScore":6,"questions":{"q1":{"id":"4.1","number":1,"title":"Participación social","question":"En caso de tener participación social de acuerdo a la respuesta del cuestionario ¿Cómo ha sido esa experiencia para ustedes como familia?","applicableTo":"ALL_LEVELS","focus":"Indagar sobre el sentido que tiene la acción o actividad social y su nivel de profundidad.\nEj. Generalmente las familias identifican este punto con la entrega de cajas de Navidad o cajas de ayuda social. Si su compromiso es donar la plata para comprarla, comprar los alimentos y dejarlos en la parroquia o colegio, esta acción estaría en el punto 1. Esta misma acción, pero con el compromiso de conocer a la familia y su realidad, serían 2 puntos. Y los 3 puntos es un compromiso permanente en cualquier acción.","rubric":{"1":{"score":1,"description":"Realizan acciones sociales esporádicas con un enfoque en donación de dinero o alimentos.\nEj: caja de navidad, kilo de alimento etc."},"2":{"score":2,"description":"Se observa una preocupación contínua por aportar a la sociedad a través de múltiples acciones.\nEn el relato de la acción realizada se muestra un interés en ayudar y participar en actividades sociales que los involucra de forma concreta como familia. Hay manifestación de la importancia que tiene la participación y ayuda a otros."},"3":{"score":3,"description":"Anhelo profundo de vivir con sentido y responsabilidad social, en concordancia con la sociedad y sus necesidades. Compromiso a través del trabajo, en su estilo de vida. Empatía con la necesidad del otro. Fomento y testimonio con sus hijos. Algo importante en su proyecto de familia. Aportar desde los talentos personales y familiares."}}}}},"observations":{"title":"OBSERVACIONES DE LOS ENTREVISTADORES","note":"Los 4 puntos que se observan se relacionan con la percepción que los entrevistadores tienen sobre los entrevistados. Por ser un colegio fundado en la pedagogía kentenijiana nos parece que es un aporte la pertenencia al Movimiento de Schoenstatt y una fidelidad de quienes pertenecen querer estar en esta comunidad.","maxScore":11,"sections":{"observations_checklist":{"title":"Cuál es su observación (5%)","maxScore":6,"items":[{"id":"obs1","text":"Pertenecen o perteneció al Movimiento de Schoenstatt","score":1,"options":["SI","NO","No Aplica o No se percibe"]},{"id":"obs2","text":"Respeto, sintonía, cariño de la pareja","score":2,"options":["SI","NO","No Aplica o No se percibe"]},{"id":"obs3","text":"Sencillez, honestidad y transparencia","score":2,"options":["SI","NO","No Aplica o No se percibe"]},{"id":"obs4","text":"Anhelo de pertenencia","score":1,"options":["SI","NO","No Aplica o No se percibe"]}]},"overall_opinion":{"title":"La opinión de las entrevistadoras, respecto a la familia que entrevistaron: (5%)","maxScore":5,"options":[{"score":5,"text":"Tenemos claridad que la familia posee el perfil de las familias del colegio MTN"},{"score":4,"text":"Tenemos claridad que la familia, posee el perfil de las familias del colegio MTN, con reparos"},{"score":3,"text":"No tenemos claridad que la familia, posea el perfil de las familias del colegio MTN"},{"score":2,"text":"Me parece que la familia, muestra un bajo perfil respecto a las familia del colegio MTN"},{"score":1,"text":"Nos parece que la familia no cumple, con el perfil de las familias del colegio MTN"}]},"justification":{"title":"Justifique en máximo 5 líneas la opción que marcó: (Observación cualitativa)","note":"En los casos de los postulantes que vienen por dificultades sociales, explicitar lo que han hecho por el niño, el camino recorrido, si hay aprendizajes, si tienden a culpar al otro, al colegio. Identificar tratamientos requeridos.","maxLines":5}}}},"gradeRanges":{"PREKINDER_2BASICO":{"description":"Pre Kinder a 2° Básico","grades":["PRE_KINDER","KINDER","1_BASICO","2_BASICO"],"applicableQuestions":["1.1","1.2a","1.3a","2.1","2.2","3.1","4.1"]},"3BASICO_4BASICO":{"description":"3° Básico a 4° Básico","grades":["3_BASICO","4_BASICO"],"applicableQuestions":["1.1","1.2b","1.3a","2.1","2.2","3.1","4.1"]},"5BASICO_3MEDIO":{"description":"5° Básico a III Medio","grades":["5_BASICO","6_BASICO","7_BASICO","8_BASICO","1_MEDIO","2_MEDIO","3_MEDIO"],"applicableQuestions":["1.1","1.2b","1.3b","2.1","2.2","3.1","4.1"]},"4MEDIO":{"description":"IV Medio","grades":["4_MEDIO"],"applicableQuestions":["1.1","1.2b","1.3b","2.1","2.2","3.1","4.1"]}},"scoringGuide":{"totalMaxScore":51,"breakdown":{"section1":{"name":"Familia y Educación de los Hijos","maxScore":18,"percentage":"35%"},"section2":{"name":"Hijo/a que Postula","maxScore":10,"percentage":"20%"},"section3":{"name":"Espiritualidad","maxScore":6,"percentage":"12%"},"section4":{"name":"Responsabilidad por la Sociedad","maxScore":6,"percentage":"12%"},"observations":{"name":"Observaciones de los Entrevistadores","maxScore":11,"percentage":"21%"}},"interviewTotal":{"maxScore":40,"percentage":"90%","note":"Suma de las 4 secciones principales (sin observaciones)"},"observationsTotal":{"maxScore":11,"percentage":"10%","breakdown":{"checklist":6,"opinion":5}}}};

/**
 * Service to manage family interview templates based on student grade level
 * Template is embedded directly in code to avoid filesystem dependencies
 */
class FamilyInterviewTemplateService {
  constructor() {
    this.template = INTERVIEW_TEMPLATE;
    logger.info('Family interview template loaded successfully (embedded)');
  }

  /**
   * Determine which grade range a specific grade belongs to
   * @param {string} grade - Grade like "PRE_KINDER", "1_BASICO", "5_BASICO", "IV_MEDIO", etc.
   * @returns {string} - Grade range key like "PREKINDER_2BASICO", "3BASICO_4BASICO", etc.
   */
  getGradeRange(grade) {
    if (!grade) {
      throw new Error('Grade is required');
    }

    const gradeRanges = this.template.gradeRanges;

    // Find which range contains this grade
    for (const [rangeKey, rangeData] of Object.entries(gradeRanges)) {
      if (rangeData.grades.includes(grade)) {
        return rangeKey;
      }
    }

    // If grade doesn't match any known range, default to the largest range
    logger.warn(`Grade ${grade} not found in any range, defaulting to 5BASICO_3MEDIO`);
    return '5BASICO_3MEDIO';
  }

  /**
   * Get the appropriate interview template for a given grade
   * Filters questions based on "applicableTo" field
   * @param {string} grade - Student's applied grade
   * @returns {object} - Filtered template with only applicable questions
   */
  getTemplateForGrade(grade) {
    const gradeRange = this.getGradeRange(grade);
    const template = JSON.parse(JSON.stringify(this.template)); // Deep clone

    // Filter sections to include only applicable questions
    const filteredSections = {};

    for (const [sectionKey, sectionData] of Object.entries(template.sections)) {
      const filteredQuestions = {};

      for (const [questionKey, questionData] of Object.entries(sectionData.questions)) {
        // Include question if it applies to ALL_LEVELS or matches the grade range
        if (questionData.applicableTo === 'ALL_LEVELS' || questionData.applicableTo === gradeRange) {
          filteredQuestions[questionKey] = questionData;
        }
      }

      // Only include section if it has questions
      if (Object.keys(filteredQuestions).length > 0) {
        filteredSections[sectionKey] = {
          ...sectionData,
          questions: filteredQuestions
        };
      }
    }

    return {
      metadata: template.metadata,
      sections: filteredSections,
      observations: template.observations,
      gradeRange: gradeRange,
      gradeApplied: grade
    };
  }

  /**
   * Calculate total score from interview responses
   * @param {object} interviewData - Responses in format {section1: {q1: {score: X}}, ...}
   * @returns {number} - Total score
   */
  calculateScore(interviewData) {
    let totalScore = 0;

    // Sum scores from all sections
    for (const [sectionKey, sectionResponses] of Object.entries(interviewData)) {
      if (sectionKey === 'observations') continue; // Observations counted separately

      for (const [questionKey, response] of Object.entries(sectionResponses)) {
        if (response && typeof response.score === 'number') {
          totalScore += response.score;
        }
      }
    }

    // Add observations score if present
    if (interviewData.observations) {
      const obsData = interviewData.observations;

      // Checklist items (1 point each)
      if (obsData.checklist) {
        for (const item of Object.values(obsData.checklist)) {
          if (item === true || item === 1) {
            totalScore += 1;
          }
        }
      }

      // Overall opinion (up to 4 points)
      if (obsData.overallOpinion && typeof obsData.overallOpinion.score === 'number') {
        totalScore += obsData.overallOpinion.score;
      }
    }

    return totalScore;
  }

  /**
   * Validate interview responses against template
   * @param {string} grade - Student's grade
   * @param {object} responses - Interview responses
   * @returns {object} - {valid: boolean, errors: []}
   */
  validateResponses(grade, responses) {
    const template = this.getTemplateForGrade(grade);
    const errors = [];

    // Check that all required sections have responses
    for (const [sectionKey, sectionData] of Object.entries(template.sections)) {
      if (!responses[sectionKey]) {
        errors.push(`Section ${sectionKey} is missing`);
        continue;
      }

      // Check that all questions in the section have responses
      for (const [questionKey, questionData] of Object.entries(sectionData.questions)) {
        if (!responses[sectionKey][questionKey]) {
          errors.push(`Question ${questionKey} in section ${sectionKey} is missing`);
        } else {
          const response = responses[sectionKey][questionKey];

          // Validate score is within valid range
          if (typeof response.score !== 'number') {
            errors.push(`Question ${questionKey} in section ${sectionKey} has invalid score`);
          } else {
            const validScores = Object.keys(questionData.rubric).map(Number);
            if (!validScores.includes(response.score)) {
              errors.push(`Question ${questionKey} in section ${sectionKey} has score ${response.score} but valid scores are: ${validScores.join(', ')}`);
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new FamilyInterviewTemplateService();
