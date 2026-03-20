// Motivational banner — contextual Spanish messages based on mood history
import { daysAgo, toDateStr } from '../lib/date-utils.js';

// --- Mood context analysis ---

export function analyzeMoodContext(allMoods) {
  const today = toDateStr();
  const yesterday = daysAgo(1);

  // Build daily averages for last 30 days
  const dailyAvgs = new Map(); // dateStr → average mood
  const dateBuckets = new Map();
  for (const m of allMoods) {
    if (!dateBuckets.has(m.date)) dateBuckets.set(m.date, []);
    dateBuckets.get(m.date).push(m.mood);
  }
  for (const [date, vals] of dateBuckets) {
    dailyAvgs.set(date, vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  const todayAvg = dailyAvgs.get(today) ?? null;
  const yesterdayAvg = dailyAvgs.get(yesterday) ?? null;

  // 7-day and 30-day averages
  const week7Vals = [];
  const month30Vals = [];
  for (let i = 0; i < 30; i++) {
    const d = daysAgo(i);
    const avg = dailyAvgs.get(d);
    if (avg !== undefined) {
      month30Vals.push(avg);
      if (i < 7) week7Vals.push(avg);
    }
  }
  const week7Avg = week7Vals.length > 0
    ? week7Vals.reduce((a, b) => a + b, 0) / week7Vals.length : null;
  const month30Avg = month30Vals.length > 0
    ? month30Vals.reduce((a, b) => a + b, 0) / month30Vals.length : null;

  // Trend: compare first-half vs second-half of 7-day window
  let trend7 = null;
  if (week7Vals.length >= 2) {
    // week7Vals is ordered [today, yesterday, ...6daysAgo]
    // first half = older days, second half = recent days
    const mid = Math.floor(week7Vals.length / 2);
    const recentHalf = week7Vals.slice(0, mid);
    const olderHalf = week7Vals.slice(mid);
    const recentAvg = recentHalf.reduce((a, b) => a + b, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((a, b) => a + b, 0) / olderHalf.length;
    const diff = recentAvg - olderAvg;
    if (diff > 0.4) trend7 = 'improving';
    else if (diff < -0.4) trend7 = 'declining';
    else trend7 = 'stable';
  }

  // Distinct dates with data in last 30 days
  let daysWithData = 0;
  for (let i = 0; i < 30; i++) {
    if (dailyAvgs.has(daysAgo(i))) daysWithData++;
  }

  // High streak: consecutive days ending today/yesterday with avg >= 4
  let highStreak = 0;
  for (let i = 0; ; i++) {
    const avg = dailyAvgs.get(daysAgo(i));
    if (avg !== undefined && avg >= 4) highStreak++;
    else break;
  }
  // If today has no entry, check starting from yesterday
  if (highStreak === 0 && todayAvg === null) {
    for (let i = 1; ; i++) {
      const avg = dailyAvgs.get(daysAgo(i));
      if (avg !== undefined && avg >= 4) highStreak++;
      else break;
    }
  }

  // Low streak: consecutive days ending today/yesterday with avg <= 2
  let lowStreak = 0;
  for (let i = 0; ; i++) {
    const avg = dailyAvgs.get(daysAgo(i));
    if (avg !== undefined && avg <= 2) lowStreak++;
    else break;
  }
  if (lowStreak === 0 && todayAvg === null) {
    for (let i = 1; ; i++) {
      const avg = dailyAvgs.get(daysAgo(i));
      if (avg !== undefined && avg <= 2) lowStreak++;
      else break;
    }
  }

  // Last entry days ago
  let lastEntryDaysAgo = null;
  if (allMoods.length > 0) {
    const sorted = [...allMoods].sort((a, b) => b.date.localeCompare(a.date));
    const lastDate = sorted[0].date;
    const todayDate = new Date(today + 'T00:00:00');
    const lastDateObj = new Date(lastDate + 'T00:00:00');
    lastEntryDaysAgo = Math.round((todayDate - lastDateObj) / (1000 * 60 * 60 * 24));
  }

  return {
    todayAvg,
    yesterdayAvg,
    week7Avg,
    month30Avg,
    trend7,
    totalEntries: allMoods.length,
    daysWithData,
    highStreak,
    lowStreak,
    lastEntryDaysAgo,
  };
}

// --- Category selection (priority order) ---

function selectCategory(ctx) {
  if (ctx.totalEntries === 0) return 'no_data';
  if (ctx.lastEntryDaysAgo >= 7) return 'returned';
  if (ctx.todayAvg !== null && ctx.todayAvg <= 2) return 'low_today';
  if (ctx.lowStreak >= 2) return 'low_streak';
  if (ctx.trend7 === 'declining') return 'declining';
  if (ctx.todayAvg !== null && ctx.todayAvg >= 4) return 'high_today';
  if (ctx.highStreak >= 3) return 'high_streak';
  if (ctx.trend7 === 'improving') return 'improving';
  if (ctx.week7Avg !== null && ctx.week7Avg >= 3.5 && ctx.trend7 === 'stable') return 'stable_good';
  if (ctx.week7Avg !== null && ctx.trend7 === 'stable') return 'stable_mid';
  if (ctx.daysWithData <= 3) return 'new_user';
  return 'default';
}

// --- Day of year for deterministic selection ---

function getDayOfYear(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const jan1 = new Date(y, 0, 1);
  return Math.floor((date - jan1) / (1000 * 60 * 60 * 24)) + 1;
}

// --- Message pools (15+ each, Spanish) ---

const MESSAGE_POOLS = {
  no_data: [
    'Bienvenida. Este es tu espacio para escucharte.',
    'Tu diario emocional empieza aquí. Sin prisa.',
    'Registra cómo te sientes. Solo tú lo verás.',
    'Hoy es un buen día para empezar a escucharte.',
    'Este espacio es tuyo. Úsalo a tu ritmo.',
    'Aquí no hay respuestas correctas, solo las tuyas.',
    'Cada registro es un paso hacia conocerte mejor.',
    'Bienvenida a tu rincón emocional.',
    'Tu historia emocional empieza con un primer registro.',
    'No necesitas palabras perfectas. Solo honestidad.',
    'Escucharte es el primer acto de cuidado propio.',
    'Todo viaje empieza con un primer paso. Este es el tuyo.',
    'Date permiso para sentir lo que sientes.',
    'Registrar tus emociones es un acto de valentía.',
    'Tu bienestar emocional importa. Empieza aquí.',
  ],
  returned: [
    'Qué bueno verte de vuelta.',
    'Aquí sigues teniendo tu espacio.',
    'Bienvenida otra vez. Tu diario te esperaba.',
    'Volver es lo que importa.',
    'Tu espacio sigue aquí, intacto.',
    'Qué bien que hayas vuelto.',
    'No importa la pausa. Lo importante es regresar.',
    'Tu diario no tiene fecha de caducidad.',
    'Volver a escucharte es un regalo.',
    'Aquí no hay juicio por las pausas.',
    'Retomar es un acto de cariño propio.',
    'El camino sigue donde lo dejaste.',
    'Cada regreso es un nuevo comienzo.',
    'Las pausas también son parte del proceso.',
    'Bienvenida de vuelta. Sigamos.',
  ],
  low_today: [
    'Los días difíciles también pasan.',
    'Hoy pesa, pero no define quién eres.',
    'Está bien no estar bien.',
    'Un mal día no es una mala vida.',
    'Sé amable contigo hoy.',
    'A veces el día más valiente es el que sobrevives.',
    'No tienes que resolver nada hoy. Solo estar.',
    'Cuidarte hoy es lo más importante.',
    'Permítete sentir sin juzgarte.',
    'Mañana es una página nueva.',
    'Hoy es un día para ir despacio.',
    'No todo tiene que tener sentido ahora.',
    'Tu fuerza no se mide por cómo te sientes hoy.',
    'Los días grises también tienen su lugar.',
    'Respira. Estás haciendo lo que puedes.',
    'Mereces compasión, especialmente de ti misma.',
  ],
  low_streak: [
    'Llevas unos días difíciles. Cuídate mucho.',
    'Los rachas malas terminan. Aguanta.',
    'Estás pasando un momento duro. No estás sola.',
    'Cada día que sigues adelante cuenta.',
    'La tormenta pasará. Siempre pasa.',
    'Sé extra amable contigo esta semana.',
    'No tienes que ser fuerte todo el tiempo.',
    'Pedir ayuda también es cuidarse.',
    'Los momentos difíciles revelan tu fortaleza.',
    'Date el permiso de ir más lento.',
    'Tu bienestar es prioridad. Trátalo así.',
    'Mereces descanso y comprensión.',
    'No minimices lo que sientes. Es válido.',
    'Cada día que registras es un acto de conciencia.',
    'Lo difícil no dura para siempre.',
  ],
  declining: [
    'He notado un bajón esta semana. Cuídate.',
    'Las cosas han ido a menos. ¿Puedes hacer algo bonito hoy?',
    'No siempre se puede ir hacia arriba. Y está bien.',
    'Presta atención a lo que necesitas ahora.',
    'A veces hay que bajar para luego subir.',
    'Reconocer el bajón es el primer paso.',
    'Tu cuerpo y mente te están pidiendo algo. Escúchalos.',
    'Las tendencias cambian. Esta también lo hará.',
    'Quizás hoy necesitas menos hacer y más ser.',
    'No ignores las señales. Son tu brújula.',
    'Cuídate como cuidarías a alguien que quieres.',
    'Un paso a la vez. Sin prisa.',
    'Permítete el descanso que necesitas.',
    'El autocuidado no es egoísmo.',
    'Ser consciente de cómo te sientes ya es avanzar.',
  ],
  high_today: [
    'Hoy brillas. Disfrútalo.',
    'Qué buen día. Saboréalo.',
    'Tu energía hoy es contagiosa.',
    'Aprovecha esta buena onda.',
    'Hoy es un día para celebrar.',
    'Qué bonito verte así de bien.',
    'Guarda este momento en la memoria.',
    'Tu sonrisa de hoy vale mucho.',
    'Días así hacen que todo valga la pena.',
    'Disfruta cada minuto de este día.',
    'Hoy todo fluye. Déjalo ser.',
    'Tu buen ánimo ilumina el día.',
    'Momentos así son los que importan.',
    'Hoy es de esos días buenos de verdad.',
    'Mereces sentirte así de bien.',
    'Qué alegría ver un día así.',
  ],
  high_streak: [
    'Llevas una racha increíble. Sigue así.',
    'Varios días sintiéndote genial. Algo estás haciendo bien.',
    'Tu constancia emocional es admirable.',
    'Qué buena racha. Disfrútala.',
    'Estás en un gran momento. Celébralo.',
    'Tu bienestar sostenido es inspirador.',
    'Días buenos que se suman. Así se construye.',
    'Estás brillando con consistencia.',
    'Tu energía positiva acumulada es poderosa.',
    'Mira todo lo que has construido estos días.',
    'Una racha así no es casualidad. Es tu esfuerzo.',
    'Sigue haciendo lo que te hace bien.',
    'Tu bienestar es tu mejor inversión.',
    'Cada día bueno refuerza el siguiente.',
    'Estás en un ciclo virtuoso. Cuídalo.',
  ],
  improving: [
    'Vas a mejor. Se nota.',
    'La tendencia es buena. Algo está cambiando.',
    'Poco a poco, hacia arriba.',
    'El cambio positivo ya empezó.',
    'Estás remontando. Sigue así.',
    'Cada día un poco mejor. Eso es progreso.',
    'La mejora es real. Confía en ella.',
    'Tu esfuerzo se refleja en cómo te sientes.',
    'Subir después de un bajón es de valientes.',
    'La curva va hacia arriba. Buen trabajo.',
    'Algo bueno está pasando. No lo sueltes.',
    'Estás encontrando tu camino de vuelta.',
    'Mejorando día a día. Paso a paso.',
    'Tu resiliencia está dando frutos.',
    'La luz al final del túnel se hace más grande.',
  ],
  stable_good: [
    'Tu equilibrio es admirable. Sigue así.',
    'Estabilidad emocional. Nada fácil, y tú lo logras.',
    'Constancia en el bienestar. Eso es fuerza.',
    'Tu calma sostenida dice mucho de ti.',
    'Mantener el equilibrio es un arte. Lo dominas.',
    'Tu serenidad es tu superpoder.',
    'Estable y bien. La mejor combinación.',
    'Tu bienestar constante no es casualidad.',
    'La paz interior se nota desde fuera.',
    'Qué bien llevas tu equilibrio emocional.',
    'Tu estabilidad es tu base más sólida.',
    'Mantenerse bien requiere esfuerzo. Lo estás haciendo.',
    'Tu constancia emocional es inspiradora.',
    'Equilibrio sostenido. Eso es madurez emocional.',
    'Sigue cuidando lo que te mantiene estable.',
  ],
  stable_mid: [
    'Día a día, paso a paso.',
    'La estabilidad es valiosa. No la subestimes.',
    'Neutral no es malo. Es tu base.',
    'Cada día cuenta, incluso los tranquilos.',
    'A veces estar bien es simplemente estar.',
    'La calma también es un estado válido.',
    'No todos los días tienen que ser extraordinarios.',
    'Tu constancia dice más que los picos.',
    'Mantener el rumbo ya es un logro.',
    'Los días normales son los cimientos.',
    'Estás presente. Eso ya es mucho.',
    'La rutina emocional también tiene su valor.',
    'Seguir adelante es siempre una victoria.',
    'Tu estabilidad es tu fortaleza silenciosa.',
    'Ni arriba ni abajo. Aquí y ahora.',
  ],
  new_user: [
    'Estás empezando algo bonito. Sigue registrando.',
    'Cada registro te acerca más a conocerte.',
    'Los primeros días son los más importantes.',
    'Tu hábito emocional está naciendo.',
    'Sigue así. La constancia trae claridad.',
    'Tres días y ya estás construyendo un hábito.',
    'Registrar es el primer paso para entender.',
    'Tu diario emocional está tomando forma.',
    'Cada entrada es una pieza del rompecabezas.',
    'Estás creando un mapa de ti misma.',
    'Pocas entradas, pero cada una vale oro.',
    'El hábito se forja día a día. Vas bien.',
    'Sigue escribiendo tu historia emocional.',
    'Los patrones emergen con el tiempo. Sigue.',
    'Tu futuro yo te agradecerá estos registros.',
  ],
  default: [
    'Hoy es un buen día para escucharte.',
    'Tu bienestar empieza por la conciencia.',
    'Registrar cómo te sientes es cuidarte.',
    'Cada día es una oportunidad de conocerte mejor.',
    'Tus emociones merecen atención.',
    'Escucharte es el mejor regalo.',
    'Hoy es tuyo. Hazlo valer.',
    'Tu historia emocional se escribe día a día.',
    'Mereces un momento para ti.',
    'Cuidar de ti no es opcional.',
    'Tus emociones son tu brújula.',
    'Un momento de reflexión puede cambiar el día.',
    'Conecta contigo. Solo un instante.',
    'Tu diario emocional cuenta tu verdad.',
    'Cada registro es un acto de amor propio.',
    'Hoy, como siempre, mereces atención.',
  ],
};

// --- Message selection with cross-category blending ---

function selectMessage(categoryKey) {
  const primary = MESSAGE_POOLS[categoryKey];
  const merged = categoryKey === 'default'
    ? primary
    : [...primary, ...MESSAGE_POOLS.default];
  const dayOfYear = getDayOfYear(toDateStr());
  return merged[dayOfYear % merged.length];
}

// --- Public render function ---

export function renderMoodBanner(allMoods) {
  const context = analyzeMoodContext(allMoods);
  const category = selectCategory(context);
  const message = selectMessage(category);
  return `<div class="mood-banner"><p class="mood-banner-text">${message}</p></div>`;
}
