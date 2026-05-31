import { applyMarkdownToHtml } from '../features/docs/utils/markdownParser';

console.log(applyMarkdownToHtml("Hello<br />World"));
console.log(applyMarkdownToHtml("• Point 1<br />• Point 2"));
