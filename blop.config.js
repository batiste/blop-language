export default {
  // Type system
  inference: true,          // Run type inference on every compile
  strictness: 'perfect',   // 'perfect' | 'warn' | 'off'
                            //   'perfect' → fail on any warning
                            //   'warn'    → emit warnings but still succeed
                            //   'off'     → skip warning reporting

  // Formatter (used by `blop --format`; CLI flags override these)
  formatter: {
    indentSize: 2,          // Spaces per indent level
    indentChar: ' ',        // Indent character (' ' or '\t')
    maxLineLength: 120,     // Break lines longer than this
  },

  // Output
  sourceMap: false,         // Emit inline source maps (CLI only)

  // Development
  debug: false,             // Log tokenise/parse timing per file

  // Extra global identifiers the backend should treat as known (no "undefined" error).
  // Useful for environment-specific globals, e.g. for a Node SSR server:
  //   globals: { __filename: true }
  // globals: {},
}
