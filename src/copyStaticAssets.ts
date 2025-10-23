import * as shell from "shelljs"

shell.cp("-R", "src/SendMail/templates", "dist/src/SendMail/templates")
shell.cp("-R", "src/templates", "dist/src/templates")
