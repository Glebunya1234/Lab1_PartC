function parseExpression(expr, varsCount) {
  let coeffs = Array(varsCount).fill(0);
  expr = expr.replace(/\s+/g, "").replace(/-/g, "+-");
  if (expr.startsWith("+")) expr = expr.substring(1);
  let parts = expr.split("+").filter(Boolean);

  for (let p of parts) {
    let match = p.match(/(-?\d*\.?\d*)x(\d+)/);
    if (match) {
      let coefStr = match[1];
      let idx = parseInt(match[2]) - 1;
      let coef = 1;
      if (coefStr === "-") coef = -1;
      else if (coefStr !== "" && coefStr !== "+") coef = parseFloat(coefStr);
      if (idx >= 0 && idx < varsCount) coeffs[idx] += coef;
    }
  }
  return coeffs;
}

function formatTable(matrix, rowLabels, colLabels) {
  let tableStr = "\n";
  tableStr += "".padStart(10);
  for (let j = 0; j < colLabels.length; j++) {
    tableStr += colLabels[j].padStart(10);
  }
  tableStr += "\n" + "-".repeat(10 + colLabels.length * 10) + "\n";

  for (let i = 0; i < matrix.length; i++) {
    let label = rowLabels[i];
    tableStr += label.padStart(8) + " |";
    for (let j = 0; j < matrix[i].length; j++) {
      tableStr += matrix[i][j].toFixed(2).padStart(10);
    }
    tableStr += "\n";
  }
  return tableStr + "\n";
}

function getX(n, labels, matrix) {
  let res = Array(n).fill(0);
  labels.forEach((l, i) => {
    if (l.startsWith("x")) {
      let match = l.match(/\d+/);
      if (match) {
        let idx = parseInt(match[0]) - 1;
        if (idx < n) res[idx] = matrix[i][matrix[0].length - 1];
      }
    }
  });
  return res;
}

function solve() {
  let obj = document.getElementById("objective").value;
  let type = document.getElementById("type").value;
  let n = parseInt(document.getElementById("varsCount").value);
  let constraintsText = document
    .getElementById("constraints")
    .value.trim()
    .split("\n");

  let log = "Згенерований протокол обчислення:\n\nПостановка задачі:\n\n";
  log += `Z = ${obj} -> ${type}\n\nпри обмеженнях:\n`;
  constraintsText.forEach((c) => (log += c + "\n"));
  log += "x[j]>=0, j=1," + n + "\n\n";

  log += "Перепишемо систему обмежень:\n\n";
  let matrix = [];
  let rowLabels = [];
  let colLabels = [];
  for (let i = 1; i <= n; i++) colLabels.push(`-x${i}`);
  colLabels.push("1");

  constraintsText.forEach((c, idx) => {
    let symbol = c.includes("<=") ? "<=" : c.includes(">=") ? ">=" : "=";
    let [left, right] = c.split(symbol);
    let coeffs = parseExpression(left, n);
    let b = parseFloat(right);

    const fmt = (num) => (num < 0 ? `(${num.toFixed(2)})` : num.toFixed(2));

    if (symbol === "=") {
      let multiplier = b > 0 ? -1 : 1;
      let printCoeffs = coeffs.map((v) => v * multiplier);
      let printB = -b * multiplier;

      let terms = printCoeffs
        .map((v, i) => `${fmt(v)} * X[${i + 1}]`)
        .join(" + ");
      log += `${terms} + ${fmt(printB)} = 0\n`;

      matrix.push([...coeffs, b]);
      rowLabels.push("0 =");
    } else if (symbol === "<=") {
      let invCoeffs = coeffs.map((v) => -v);
      let termsInv = invCoeffs
        .map((v, i) => `${fmt(v)} * X[${i + 1}]`)
        .join(" + ");
      log += `${termsInv} + ${fmt(b)} >= 0\n`;

      matrix.push([...coeffs, b]);
      rowLabels.push(`y${idx + 1} =`);
    } else {
      let terms = coeffs.map((v, i) => `${fmt(v)} * X[${i + 1}]`).join(" + ");
      log += `${terms} + ${fmt(-b)} >= 0\n`;

      matrix.push([...coeffs.map((v) => -v), -b]);
      rowLabels.push(`y${idx + 1} =`);
    }
  });

  let objCoeffs = parseExpression(obj, n);
  matrix.push([...objCoeffs.map((x) => -x), 0]);
  rowLabels.push("Z =");

  log +=
    "\nВхідна симплекс-таблиця:\n" + formatTable(matrix, rowLabels, colLabels);

  function mjvPivot(r, c) {
    log += `Розв'язувальний рядок: ${rowLabels[r].replace("=", "").trim()}\n`;
    log += `Розв'язувальний стовпець: ${colLabels[c]}\n`;

    let p = matrix[r][c];
    let nextMatrix = Array.from({ length: matrix.length }, () =>
      Array(matrix[0].length).fill(0),
    );

    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[0].length; j++) {
        if (i === r && j === c) nextMatrix[i][j] = 1 / p;
        else if (i === r) nextMatrix[i][j] = matrix[r][j] / p;
        else if (j === c) nextMatrix[i][j] = -matrix[i][c] / p;
        else
          nextMatrix[i][j] = matrix[i][j] - (matrix[i][c] * matrix[r][j]) / p;
      }
    }

    let outgoing = rowLabels[r].replace(" =", "").trim();
    let incoming = colLabels[c].replace("-", "");

    rowLabels[r] = incoming + " =";
    colLabels[c] = "-" + (outgoing === "0" ? "y_null" : outgoing);

    matrix = nextMatrix;
  }

  log += "\nВидалення нуль-рядків:\n";
  while (true) {
    let r = -1;
    for (let i = 0; i < matrix.length - 1; i++) {
      if (rowLabels[i] === "0 =") {
        r = i;
        break;
      }
    }
    if (r === -1) break;

    let c = -1;
    for (let j = 0; j < matrix[0].length - 1; j++) {
      if (Math.abs(matrix[r][j]) > 1e-6) {
        c = j;
        break;
      }
    }

    if (c !== -1) {
      mjvPivot(r, c);
      let colIdx = c;
      matrix.forEach((row) => row.splice(colIdx, 1));
      colLabels.splice(colIdx, 1);
      log += formatTable(matrix, rowLabels, colLabels);
    }
  }
  log += "Bci нуль-рядки видалено.\n\n";

  log += "Пошук опорного розв'язку:\n";
  while (true) {
    let r = -1;
    let minB = -1e-6;
    for (let i = 0; i < matrix.length - 1; i++) {
      if (matrix[i][matrix[0].length - 1] < minB) {
        minB = matrix[i][matrix[0].length - 1];
        r = i;
      }
    }
    if (r === -1) break;

    let c = -1;
    for (let j = 0; j < matrix[0].length - 1; j++) {
      if (matrix[r][j] < -1e-6) {
        c = j;
        break;
      }
    }
    if (c === -1) break;

    mjvPivot(r, c);
    log += formatTable(matrix, rowLabels, colLabels);
  }

  let curX = getX(n, rowLabels, matrix);
  log += "Знайдено опорний розв'язок:\n";
  log += "X = (" + curX.map((v) => v.toFixed(2)).join("; ") + ")\n\n";

  log += "Пошук оптимального розв'язку:\n";
  while (true) {
    let lastR = matrix.length - 1;
    let c = -1;
    let minZ = -1e-6;
    for (let j = 0; j < matrix[0].length - 1; j++) {
      if (matrix[lastR][j] < minZ) {
        minZ = matrix[lastR][j];
        c = j;
      }
    }
    if (c === -1) break;

    let r = -1,
      minRatio = Infinity;
    for (let i = 0; i < matrix.length - 1; i++) {
      if (matrix[i][c] > 1e-6) {
        let ratio = matrix[i][matrix[0].length - 1] / matrix[i][c];
        if (ratio < minRatio) {
          minRatio = ratio;
          r = i;
        }
      }
    }
    if (r === -1) break;

    mjvPivot(r, c);
    log += formatTable(matrix, rowLabels, colLabels);
  }

  let finalX = getX(n, rowLabels, matrix);
  let zVal = matrix[matrix.length - 1][matrix[0].length - 1];
  if (type === "min") zVal = -zVal;

  log += "Знайдено оптимальний розв'язок:\n";
  log += "X = (" + finalX.map((v) => v.toFixed(2)).join("; ") + ")\n";
  log += (type === "max" ? "Max" : "Min") + " (Z) = " + zVal.toFixed(2);

  document.getElementById("output").innerText = log;
}
