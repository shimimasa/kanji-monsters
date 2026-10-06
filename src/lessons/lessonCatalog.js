// First two subject journeys adapted from shimimasa/elementgirl-lesson.
// The playable Gotomon versions live in public/lessons/gotomon.
// Their IDs are separate from the square's fixed 50 mini-game Gotomon.
const LESSONS = [
  { slug: 'kururu', id: 'EL-001', title: 'クルルの発電所', name: 'クルル', subject: '理科', gradeLabel: '小6', topic: '発電・蓄電・センサー', type: 'craft',
    category: '理科・社会の旅のゴトモン', habitat: 'クルルの発電所', description: '手回し発電機の取っ手から生まれた精霊。電気を作り、ため、上手に使う実験を案内する。', appearance: '緑の丸い体、発電機の取っ手、稲妻の角' },
  { slug: 'hitotsubu', id: 'EL-002', title: 'ひとつぶ村', name: 'ヒョウ', subject: '社会', gradeLabel: '小6', topic: '選挙・一票の重み', type: 'history',
    category: '理科・社会の旅のゴトモン', habitat: 'ひとつぶ村', description: '投票箱の精霊。みんなの声を大切に集め、村の未来を一緒に考える。', appearance: '投票箱の体、紙がのぞく頭、黄色の旗' },
];
export const lessonCatalog = Object.freeze(LESSONS.map(lesson => Object.freeze({
  ...lesson, imageUrl: `/assets/images/monsters/full/lesson/${lesson.id}.svg`,
  url: `/lessons/gotomon/${lesson.slug}.html`,
  sheetUrl: `/lessons/gotomon/${lesson.slug}-sheet.html`,
})));
export const lessonForSlug = slug => lessonCatalog.find(lesson => lesson.slug === slug) ?? null;
export const lessonGotomonById = id => lessonCatalog.find(lesson => lesson.id === id) ?? null;
