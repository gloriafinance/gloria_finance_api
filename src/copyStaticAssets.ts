import * as shell from "shelljs"

shell.cp("-R", "src/SendMail/templates", "dist/SendMail/templates")
shell.cp("-R", "src/templates", "dist/templates")
