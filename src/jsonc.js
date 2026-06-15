export function parseJsonc(source, file = "JSONC input") {
  const withoutComments = stripJsonComments(source);
  const withoutTrailingCommas = stripTrailingCommas(withoutComments);

  try {
    return JSON.parse(withoutTrailingCommas);
  } catch (error) {
    error.message = `${file}: ${error.message}`;
    throw error;
  }
}

export function stripJsonComments(source) {
  let output = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === "\n" || char === "\r") {
        inLineComment = false;
        output += char;
      } else {
        output += " ";
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        output += "  ";
        inBlockComment = false;
        index += 1;
      } else {
        output += char === "\n" || char === "\r" ? char : " ";
      }
      continue;
    }

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      output += "  ";
      inLineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      output += "  ";
      inBlockComment = true;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

export function stripTrailingCommas(source) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      output += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (/\s/.test(source[lookahead] ?? "")) {
        lookahead += 1;
      }
      if (source[lookahead] === "}" || source[lookahead] === "]") {
        output += " ";
        continue;
      }
    }

    output += char;
  }

  return output;
}
