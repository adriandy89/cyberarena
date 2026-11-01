import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Server-side markdown rendering for task guides (ADR-011): react-markdown
 * never renders raw HTML, so author content cannot inject scripts.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2 className="mt-6 text-xl font-bold text-slate-100">{children}</h2>
          ),
          h2: ({ children }) => (
            <h3 className="mt-6 text-lg font-semibold text-slate-100">{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="mt-4 font-semibold text-slate-200">{children}</h4>
          ),
          p: ({ children }) => <p className="text-slate-300">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-6 text-slate-300">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-6 text-slate-300">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-100">{children}</strong>
          ),
          em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} className="text-emerald-400 underline underline-offset-2" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-emerald-500/40 pl-4 text-slate-400">{children}</blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/80 p-4 font-mono text-sm text-emerald-300">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[13px] text-emerald-300">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="w-full">{children}</pre>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
