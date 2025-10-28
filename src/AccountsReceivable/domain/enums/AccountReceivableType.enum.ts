export enum AccountReceivableType {
  CONTRIBUTION = "CONTRIBUTION", // Compromiso voluntario de miembro/grupo
  SERVICE = "SERVICE", // Servicios prestados por la iglesia: cursos, eventos
  INTERINSTITUTIONAL = "INTERINSTITUTIONAL", // Relación con otra iglesia/organización: Convenios, soporte, eventos conjuntos
  RENTAL = "RENTAL", // Arrendamiento de recursos de la iglesia
  LOAN = "LOAN", //Préstamo otorgado por la iglesia que debe ser devuelto (Préstamo interno con comprobantes de transferencia)
  FINANCIAL = "FINANCIAL", //Movimientos bancarios en proceso de cobro: Cheques, adquirencia, devoluciones
  LEGAL = "LEGAL", // Cobros en demanda / seguros / indemnizaciones
}
