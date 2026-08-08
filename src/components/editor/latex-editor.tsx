"use client";

import * as React from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { autocompletion, type CompletionContext } from "@codemirror/autocomplete";
import { searchKeymap } from "@codemirror/search";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * LaTeX source editor.
 *
 * A plain `<textarea>` cannot offer bracket matching, structural highlighting
 * or a save keybinding, all of which matter when the document being edited is
 * the thing standing between the user and a job.
 */

const LATEX_COMPLETIONS = [
  { label: "\\section{}", type: "keyword", detail: "Top-level heading" },
  { label: "\\subsection{}", type: "keyword", detail: "Sub-heading" },
  { label: "\\textbf{}", type: "keyword", detail: "Bold" },
  { label: "\\textit{}", type: "keyword", detail: "Italic" },
  { label: "\\underline{}", type: "keyword", detail: "Underline" },
  { label: "\\item ", type: "keyword", detail: "List item" },
  { label: "\\href{}{}", type: "keyword", detail: "Hyperlink" },
  { label: "\\begin{itemize}", type: "keyword", detail: "Bullet list" },
  { label: "\\end{itemize}", type: "keyword", detail: "Close bullet list" },
  { label: "\\vspace{}", type: "keyword", detail: "Vertical space" },
  { label: "\\hfill", type: "keyword", detail: "Horizontal fill" },
  { label: "\\%", type: "constant", detail: "Literal percent sign" },
  { label: "\\&", type: "constant", detail: "Literal ampersand" },
  { label: "\\$", type: "constant", detail: "Literal dollar sign" },
];

function latexCompletionSource(context: CompletionContext) {
  const word = context.matchBefore(/\\[a-zA-Z{}%&$]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: LATEX_COMPLETIONS,
    validFor: /^\\[a-zA-Z{}%&$]*$/,
  };
}

/** Theme bound to the app's CSS custom properties so both modes stay in sync. */
function editorTheme(isDark: boolean) {
  return EditorView.theme(
    {
      "&": {
        backgroundColor: "var(--surface)",
        color: "var(--ink)",
        fontSize: "12.5px",
        height: "100%",
      },
      ".cm-content": {
        fontFamily: "var(--font-mono)",
        padding: "12px 0",
        caretColor: "var(--primary)",
        lineHeight: "1.6",
      },
      ".cm-gutters": {
        backgroundColor: "var(--sunken)",
        color: "var(--ink-3)",
        border: "none",
        borderRight: "1px solid var(--line)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
      },
      ".cm-activeLine": { backgroundColor: "var(--surface-2)" },
      ".cm-activeLineGutter": {
        backgroundColor: "var(--surface-2)",
        color: "var(--ink-2)",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "var(--primary-soft)",
      },
      "&.cm-focused": { outline: "none" },
      ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--primary)" },
      ".cm-searchMatch": {
        backgroundColor: "var(--warn-soft)",
        outline: "1px solid var(--warn-border)",
      },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--primary-soft)",
      },
      ".cm-tooltip": {
        backgroundColor: "var(--surface)",
        border: "1px solid var(--line-2)",
        borderRadius: "var(--radius-sm)",
        boxShadow: "var(--shadow-md)",
      },
      ".cm-tooltip-autocomplete ul li[aria-selected]": {
        backgroundColor: "var(--primary-soft)",
        color: "var(--primary-ink)",
      },
      ".cm-panels": {
        backgroundColor: "var(--surface-2)",
        color: "var(--ink)",
        borderColor: "var(--line)",
      },
    },
    { dark: isDark },
  );
}

export interface LatexEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  height?: string;
  /** Announced by screen readers; the editor is not a labelled form control. */
  ariaLabel?: string;
}

export function LatexEditor({
  value,
  onChange,
  onSave,
  readOnly = false,
  placeholder = "Paste your resume .tex source here…",
  className,
  height = "100%",
  ariaLabel = "LaTeX source editor",
}: LatexEditorProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const ref = React.useRef<ReactCodeMirrorRef>(null);

  const handleSave = React.useEffectEvent(() => {
    onSave?.();
  });

  const [extensions] = React.useState(() => [
    StreamLanguage.define(stex),
    autocompletion({ override: [latexCompletionSource] }),
    EditorView.lineWrapping,
    keymap.of(searchKeymap),
    Prec.highest(
      keymap.of([
        {
          key: "Mod-s",
          preventDefault: true,
          run: () => {
            handleSave();
            return true;
          },
        },
      ]),
    ),
  ]);

  return (
    <div
      className={cn("min-h-0 flex-1 overflow-hidden", className)}
      // CodeMirror manages its own focus and ARIA roles internally.
      role="group"
      aria-label={ariaLabel}
    >
      <CodeMirror
        ref={ref}
        value={value}
        onChange={onChange}
        height={height}
        readOnly={readOnly}
        placeholder={placeholder}
        theme={editorTheme(isDark)}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          searchKeymap: false,
          tabSize: 2,
        }}
      />
    </div>
  );
}
