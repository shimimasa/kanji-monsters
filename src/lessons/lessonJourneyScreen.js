import { publish } from '../core/eventBus.js';
import { element, button, isolateScreen } from '../ui/adventureUI.js';
import { LESSON_GAMES_ENABLED, lessonForSlug } from './lessonCatalog.js';
import { captureLesson, recordLessonProgress } from './lessonCapture.js';
import './lessonJourney.css';

const screen = {
  enter({ slug } = {}) {
    this.exit();
    const lesson = lessonForSlug(slug);
    if (!LESSON_GAMES_ENABLED || !lesson) { publish('changeScreen', 'miniGameHub'); return; }
    this.lesson = lesson;
    publish('stopBGM', 0.2);
    const doc = document;
    const root = element(doc, 'section', 'yt-world yt-lesson-journey');
    root.id = 'lessonJourney';
    root.setAttribute('aria-label', `${lesson.title}の授業`);
    const header = element(doc, 'header', 'yt-lesson-header');
    const back = button(doc, '← 広場にもどる', () => publish('changeScreen', 'miniGameHub'), 'yt-lesson-back');
    const sheet = button(doc, 'きろくシート', () => window.open(lesson.sheetUrl, '_blank', 'noopener'), 'yt-lesson-sheet');
    const title = element(doc, 'div', 'yt-lesson-heading');
    title.append(element(doc, 'strong', '', `${lesson.subject}の旅 · ${lesson.title}`),
      element(doc, 'small', '', `${lesson.topic} · さいごまで あそぶと ${lesson.name}が なかまになるよ`));
    this.status = element(doc, 'span', 'yt-lesson-status', '星を あつめよう 0/5');
    header.append(back, title, sheet, this.status);
    const frame = element(doc, 'iframe', 'yt-lesson-frame');
    frame.title = `${lesson.title}の授業ゲーム`;
    frame.src = lesson.url;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
    frame.setAttribute('allow', 'autoplay; fullscreen');
    root.append(header, frame);
    doc.body.append(root);
    this.root = root;
    this.frame = frame;
    this.restore = isolateScreen(doc, root);
    this.completed = false;
    this.onMessage = event => {
      if (event.origin !== location.origin || event.source !== this.frame?.contentWindow) return;
      const data = event.data;
      if (data?.type !== 'yomitabi.lesson' || data.slug !== lesson.slug || data.total !== 5) return;
      if (data.kind === 'progress' && Number.isInteger(data.count) && data.count >= 0 && data.count <= 5) {
        this.status.textContent = `星を あつめよう ${data.count}/5`;
        recordLessonProgress(lesson.slug, data);
      }
      if (data.kind === 'complete' && data.count === 5 && !this.completed) {
        this.completed = true;
        this.showCompletion();
      }
    };
    window.addEventListener('message', this.onMessage);
    back.focus({ preventScroll: true });
  },
  showCompletion() {
    const lesson = this.lesson;
    const outcome = captureLesson(lesson.slug, { count: 5, total: 5 });
    this.result?.remove();
    const result = element(document, 'div', 'yt-lesson-result');
    const panel = element(document, 'div', 'yt-lesson-result-panel');
    if (outcome.ok) {
      const portrait = element(document, 'img', 'yt-lesson-friend');
      portrait.src = lesson.imageUrl; portrait.alt = lesson.name;
      panel.append(portrait,
        element(document, 'h2', '', outcome.newFriend ? `${lesson.name}が なかまになったよ！` : `${lesson.name}と また あえたね！`),
        element(document, 'p', '', `${lesson.title}を さいごまで たんけんしたね。`),
        button(document, '理科・社会の旅へ', () => publish('changeScreen', 'miniGameHub'), 'yt-lesson-primary'),
        button(document, '図鑑で あう', () => publish('changeScreen', { name: 'monsterDex', props: { currentMode: 'lesson' } })));
    } else {
      panel.append(element(document, 'h2', '', 'さいごまで たんけんしたね！'),
        element(document, 'p', '', `${lesson.name}の なかまの記録を もういちど 保存してみよう。`),
        button(document, 'もういちど 保存する', () => this.showCompletion(), 'yt-lesson-primary'),
        button(document, '広場にもどる', () => publish('changeScreen', 'miniGameHub')));
    }
    result.append(panel);
    this.root.append(result);
    this.result = result;
    panel.querySelector('button')?.focus();
  },
  exit() {
    if (this.onMessage) window.removeEventListener('message', this.onMessage);
    this.onMessage = null;
    this.frame?.removeAttribute('src');
    this.restore?.(); this.restore = null;
    this.root?.remove(); this.root = null;
    this.frame = null; this.result = null; this.lesson = null; this.completed = false;
  },
};
export default screen;
