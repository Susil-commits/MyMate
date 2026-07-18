const fs = require('fs');
let file = fs.readFileSync('utils/validators.ts', 'utf8');
file = file.replace('import { body } from "express-validator";', 'import { body, validationResult } from "express-validator";\n\nexport const validateRequest = (req, res, next) => {\n  const errors = validationResult(req);\n  if (!errors.isEmpty()) {\n    return res.status(400).json({ message: errors.array()[0].msg });\n  }\n  next();\n};\n');
file = file.replace(/\];/g, ', validateRequest];');
fs.writeFileSync('utils/validators.ts', file);
