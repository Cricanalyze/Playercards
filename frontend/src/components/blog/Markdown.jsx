import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fileUrl } from "@/lib/files";

const components = {
  img: ({ src, alt }) => <img src={fileUrl(src)} alt={alt || ""} loading="lazy" />,
  a: ({ href, children }) => <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{children}</a>,
};

export const Markdown = ({ children, testId }) => (
  <div className="prose-blog" data-testid={testId}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{children || ""}</ReactMarkdown>
  </div>
);
