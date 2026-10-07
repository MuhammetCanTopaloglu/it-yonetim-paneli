import ReactMarkdown from "react-markdown";

/**
 * react-markdown varsayılan olarak ham HTML render etmez (rehype-raw eklenmedi),
 * bu yüzden içerikteki <script> vb. etiketler metin olarak kalır, XSS riski oluşmaz.
 * Bilinçli olarak rehype-raw eklenmedi — eklenirse bu güvenlik garantisi kaybolur.
 */
const MARKDOWN_CLASSES = [
  "text-sm leading-relaxed",
  "[&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5",
  "[&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5",
  "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
  "[&_p]:mb-2",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2",
  "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2",
  "[&_li]:mb-0.5",
  "[&_a]:text-accent [&_a]:underline",
  "[&_code]:font-mono [&_code]:bg-surface-secondary [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
  "[&_pre]:font-mono [&_pre]:bg-surface-secondary [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:mb-2",
  "[&_blockquote]:border-l-2 [&_blockquote]:border-accent/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-secondary",
  "[&_hr]:my-3"
].join(" ");

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className={MARKDOWN_CLASSES}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
