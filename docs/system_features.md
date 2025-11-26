# Church Finance API – Catálogo Funcional de Características

> **Última actualización:** Noviembre 2025  
> Este documento describe todas las funcionalidades del sistema de gestión financiera para iglesias.

---

## Tabla de Contenidos

1. [Gestión de Iglesias](#gestión-de-iglesias)
2. [Gestión de Miembros](#gestión-de-miembros)
3. [Gestión de Ministros](#gestión-de-ministros)
4. [Cuentas por Pagar](#cuentas-por-pagar)
5. [Cuentas por Cobrar](#cuentas-por-cobrar)
6. [Configuración Financiera](#configuración-financiera)
7. [Conceptos Financieros](#conceptos-financieros)
8. [Cuentas de Disponibilidad](#cuentas-de-disponibilidad)
9. [Centros de Costo](#centros-de-costo)
10. [Registros Financieros](#registros-financieros)
11. [Contribuciones Online](#contribuciones-online)
12. [Control Financiero Consolidado](#control-financiero-consolidado)
13. [Sistema Bancario](#sistema-bancario)
14. [Conciliación Bancaria](#conciliación-bancaria)
15. [Compras](#compras)
16. [Patrimonio (Gestión de Activos)](#patrimonio-gestión-de-activos)
17. [Reportes y Analíticas](#reportes-y-analíticas)
18. [Sistema de Seguridad y Autenticación](#sistema-de-seguridad-y-autenticación)
19. [Control de Acceso Basado en Roles (RBAC)](#control-de-acceso-basado-en-roles-rbac)
20. [Notificaciones y Comunicaciones](#notificaciones-y-comunicaciones)
21. [Catálogos Geográficos](#catálogos-geográficos)
22. [Trabajos en Cola (Background Jobs)](#trabajos-en-cola-background-jobs)

---

## Gestión de Iglesias

### Crear o Actualizar Iglesia
- **Archivo:** `src/Church/applications/church/CreateOrUpdateChurch.ts`
- **Descripción:** Registra y actualiza registros de iglesias, incluyendo dirección, detalles de contacto, estado y fecha de apertura.
- **Funcionalidades:**
  - Crea nuevas entradas cuando no se proporciona `churchId`
  - Edita congregaciones existentes cuando se proporciona `churchId`
  - Valida existencia de la iglesia antes de actualizar
  - Permite configurar: ciudad, dirección, calle, número, código postal, email, fecha de apertura, número de registro, estado

### Buscar Iglesias
- **Archivo:** `src/Church/applications/church/SearchChurches.ts`
- **Descripción:** Búsqueda paginada de congregaciones con filtros flexibles.
- **Funcionalidades:**
  - Filtros por región (`regionId`)
  - Filtros por estado (`status`)
  - Paginación configurable

### Buscar Iglesias por Distrito
- **Archivo:** `src/Church/applications/church/SearchChurchesByDistrictId.ts`
- **Descripción:** Recupera congregaciones vinculadas a un distrito específico.

### Iglesias sin Ministro Asignado
- **Archivo:** `src/Church/applications/church/WithoutAssignedMinister.ts`
- **Descripción:** Lista las iglesias que operan sin un ministro asignado para facilitar la supervisión.

### Buscar Iglesia por ID
- **Archivo:** `src/Church/applications/church/FindChurchById.ts`
- **Descripción:** Obtiene los detalles de una iglesia específica por su identificador.

---

## Gestión de Miembros

### Crear o Actualizar Miembro
- **Archivo:** `src/Church/applications/members/CreateOrUpdateMember.ts`
- **Descripción:** Gestiona perfiles de miembros de la iglesia.
- **Funcionalidades:**
  - Crea nuevos miembros con validación de DNI duplicado
  - Actualiza miembros existentes (nombre, email, teléfono, fecha de nacimiento, fecha de bautismo, fecha de conversión)
  - Sincroniza afiliación de la iglesia
  - Activa/desactiva miembros
  - Dispara automáticamente la creación de usuario en cola de trabajo (`CreateUserForMemberJob`)

### Buscar Miembros
- **Archivo:** `src/Church/applications/members/SearchMembers.ts`
- **Descripción:** Búsqueda paginada de miembros.
- **Funcionalidades:**
  - Filtros por región (`regionId`)
  - Filtros por iglesia (`churchId`)
  - Paginación configurable

### Obtener Todos los Miembros
- **Archivo:** `src/Church/applications/members/AllMember.ts`
- **Descripción:** Lista todos los miembros de una iglesia específica.

### Buscar Miembro por ID
- **Archivo:** `src/Church/applications/members/FindMemberById.ts`
- **Descripción:** Obtiene los detalles de un miembro específico por su identificador.

---

## Gestión de Ministros

### Registrar o Actualizar Ministro
- **Archivo:** `src/Church/applications/ministers/RegisterOrUpdateMinister.ts`
- **Descripción:** Registra nuevos ministros o actualiza los existentes.
- **Funcionalidades:**
  - Busca por DNI para evitar duplicados
  - Configura: nombre, email, teléfono, tipo de ministro

### Asignar Iglesia a Ministro
- **Archivo:** `src/Church/applications/ministers/AssignChurch.ts`
- **Descripción:** Vincula ministros a iglesias aplicando reglas de exclusividad.
- **Funcionalidades:**
  - Valida que la iglesia no tenga un ministro asignado
  - Valida que el ministro no tenga una iglesia asignada
  - Actualiza el estado de la iglesia a ACTIVO
  - Enlaza bidireccional entre ministro e iglesia

### Remover Ministro de Iglesia
- **Archivo:** `src/Church/applications/ministers/RemoveMinister.ts`
- **Descripción:** Desvincula un ministro de su congregación.
- **Funcionalidades:**
  - Valida que la iglesia tenga un ministro asignado
  - Actualiza el estado de la iglesia a "SIN MINISTRO"
  - Elimina la referencia del ministro a la iglesia

### Buscar Ministro por ID
- **Archivo:** `src/Church/applications/ministers/FindMinisterById.ts`
- **Descripción:** Obtiene los detalles de un ministro específico por su identificador.

---

## Cuentas por Pagar

### Registrar Proveedores
- **Archivo:** `src/AccountsPayable/applications/RegisterSuppliers.ts`
- **Descripción:** Registra nuevos proveedores con detección de duplicados por DNI.
- **Funcionalidades:**
  - Validación de proveedor existente
  - Prevención de registros duplicados

### Listar Todos los Proveedores
- **Archivo:** `src/AccountsPayable/applications/AllSupplier.ts`
- **Descripción:** Lista todos los proveedores de una iglesia específica.

### Crear Cuenta por Pagar
- **Archivo:** `src/AccountsPayable/applications/CreateAccountPayable.ts`
- **Descripción:** Crea entradas de cuentas por pagar con datos de proveedor validados.
- **Funcionalidades:**
  - Valida existencia del proveedor
  - Incluye datos del proveedor (ID, tipo, DNI, nombre, teléfono)
  - Logging de operaciones

### Listar Cuentas por Pagar
- **Archivo:** `src/AccountsPayable/applications/ListAccountsPayable.ts`
- **Descripción:** Lista paginada de cuentas por pagar.
- **Funcionalidades:**
  - Filtros por iglesia (`churchId`)
  - Filtros por estado (`status`)
  - Filtros por rango de fechas (`startDate`, `endDate`)
  - Ordenamiento por fecha de creación descendente

### Pagar Cuenta por Pagar
- **Archivo:** `src/AccountsPayable/applications/PayAccountPayable.ts`
- **Descripción:** Procesa pagos de cuotas de cuentas por pagar.
- **Funcionalidades:**
  - Localiza la cuenta por pagar
  - Valida centros de costo y cuentas de disponibilidad
  - Actualiza cuotas (parcial o total)
  - Genera registros financieros automáticamente
  - Protección de rollback en caso de errores
  - Actualiza saldos pendientes

---

## Cuentas por Cobrar

### Crear Cuenta por Cobrar
- **Archivo:** `src/AccountsReceivable/applications/CreateAccountReceivable.ts`
- **Descripción:** Registra cuentas por cobrar con validación de concepto financiero.
- **Funcionalidades:**
  - Valida existencia del concepto financiero
  - Auto-acepta contribuciones automáticamente
  - Envía emails de compromiso de pago para otros tipos de cuentas por cobrar

### Listar Cuentas por Cobrar
- **Archivo:** `src/AccountsReceivable/applications/ListAccountReceivable.ts`
- **Descripción:** Lista paginada de cuentas por cobrar.
- **Funcionalidades:**
  - Filtros por iglesia (`churchId`)
  - Filtros por estado (`status`)
  - Filtros por rango de fechas (`startDate`, `endDate`)

### Listar Cuentas por Cobrar de Miembro
- **Archivo:** `src/AccountsReceivable/applications/ListMemberAccountReceivable.ts`
- **Descripción:** Lista cuentas por cobrar específicas de un miembro.
- **Funcionalidades:**
  - Filtros por DNI del deudor
  - Filtros por iglesia
  - Filtros por tipo de cuenta (por defecto: CONTRIBUCIÓN)
  - Filtros por estado

### Confirmar o Rechazar Compromiso de Pago
- **Archivo:** `src/AccountsReceivable/applications/ConfirmOrDenyPaymentCommitment.ts`
- **Descripción:** Gestiona aceptación o rechazo de compromisos de pago.
- **Funcionalidades:**
  - Localiza acuerdos pendientes por token
  - Marca aceptación o rechazo
  - Genera contratos PDF firmados para casos aceptados (incluye datos de iglesia, ministro y deudor)

### Pagar Cuenta por Cobrar
- **Archivo:** `src/AccountsReceivable/applications/PayAccountReceivable.ts`
- **Descripción:** Aplica pagos entrantes a cuentas por cobrar.
- **Funcionalidades:**
  - Valida cuotas
  - Actualiza saldos
  - Genera registros financieros de tipo INGRESO
  - Protección de rollback

### Declarar Pago de Cuota
- **Archivo:** `src/AccountsReceivable/applications/DeclareInstallmentPayment.ts`
- **Descripción:** Permite a miembros declarar pagos de cuotas.
- **Funcionalidades:**
  - Valida miembro y cuenta por cobrar
  - Registra contribución online
  - Marca cuota en revisión

---

## Configuración Financiera

### Conceptos Financieros

#### Crear o Actualizar Concepto Financiero
- **Archivo:** `src/Financial/applications/financialConcept/CreateOrUpdateFinancialConcept.ts`
- **Descripción:** Gestiona conceptos financieros para cada iglesia.
- **Funcionalidades:**
  - Crea nuevos conceptos financieros
  - Actualiza conceptos existentes
  - Configura: nombre, descripción, tipo, categoría de estado
  - Banderas de impacto: afecta flujo de caja, afecta resultado, afecta balance, es operacional
  - Activa/desactiva conceptos

#### Buscar Concepto Financiero
- **Archivo:** `src/Financial/applications/financialConcept/FindFinancialConceptByChurchIdAndFinancialConceptId.ts`
- **Descripción:** Obtiene un concepto financiero específico por ID de iglesia y concepto.

#### Listar Conceptos Financieros por Tipo
- **Archivo:** `src/Financial/applications/financialConcept/FindFinancialConceptsByChurchIdAndTypeConcept.ts`
- **Descripción:** Lista conceptos financieros filtrados por tipo (INGRESO, EGRESO, COMPRA, REVERSIÓN).

#### Carga Inicial de Conceptos Financieros
- **Archivo:** `src/Financial/applications/financialConcept/FirstLoadFinancialConcepts.ts`
- **Descripción:** Carga inicial de conceptos financieros desde archivo de fixture para nuevas iglesias.

---

## Cuentas de Disponibilidad

### Crear o Actualizar Cuenta de Disponibilidad
- **Archivo:** `src/Financial/applications/availabilityAccount/CreateOrUpdateAvailabilityAccount.ts`
- **Descripción:** Gestiona cuentas de disponibilidad (caja, banco).
- **Funcionalidades:**
  - Crea nuevas cuentas de disponibilidad
  - Actualiza cuentas existentes
  - Configura: nombre de cuenta, tipo de cuenta, símbolo de moneda, origen (bancario)
  - Activa/desactiva cuentas

### Buscar Cuenta de Disponibilidad por ID
- **Archivo:** `src/Financial/applications/availabilityAccount/FindAvailabilityAccountByAvailabilityAccountId.ts`
- **Descripción:** Obtiene una cuenta de disponibilidad validando acceso por iglesia.
- **Funcionalidades:**
  - Valida existencia de la cuenta
  - Valida que la cuenta pertenezca a la iglesia correcta

### Listar Cuentas de Disponibilidad por Iglesia
- **Archivo:** `src/Financial/applications/availabilityAccount/SearchAvailabilityAccountByChurchId.ts`
- **Descripción:** Lista cuentas de disponibilidad activas de una iglesia.

### Actualizar Balance de Cuenta de Disponibilidad Master
- **Archivo:** `src/Financial/applications/availabilityAccount/UpdateAvailabilityAccountMaster.ts`
- **Descripción:** Actualiza el saldo maestro mensual de cuentas de disponibilidad.
- **Funcionalidades:**
  - Crea registro maestro si no existe
  - Actualiza ingresos/egresos según operación
  - Identificación por período (año/mes)

---

## Centros de Costo

### Crear Centro de Costo
- **Archivo:** `src/Financial/applications/costCenter/CreateCostCenter.ts`
- **Descripción:** Registra nuevos centros de costo.
- **Funcionalidades:**
  - Valida existencia del miembro responsable
  - Valida que no exista centro de costo con mismo ID
  - Configura: ID, nombre, categoría, descripción, miembro responsable

### Actualizar Centro de Costo
- **Archivo:** `src/Financial/applications/costCenter/UpdateCostCenter.ts`
- **Descripción:** Actualiza centros de costo existentes.
- **Funcionalidades:**
  - Valida existencia del centro de costo
  - Valida existencia del miembro responsable
  - Actualiza datos del centro de costo

### Buscar Centro de Costo por ID
- **Archivo:** `src/Financial/applications/costCenter/FindCostCenterByCostCenterId.ts`
- **Descripción:** Obtiene un centro de costo específico por ID.

### Listar Centros de Costo por Iglesia
- **Archivo:** `src/Financial/applications/costCenter/SearchCostCenterByChurchId.ts`
- **Descripción:** Lista todos los centros de costo de una iglesia.

---

## Registros Financieros

### Despachar Creación de Registro Financiero
- **Archivo:** `src/Financial/applications/dispatchers/DispatchCreateFinancialRecord.ts`
- **Descripción:** Encola la creación de registros financieros para procesamiento asíncrono.

### Crear Registro Financiero (Job)
- **Archivo:** `src/Financial/applications/jobs/CreateFinancialRecord.job.ts`
- **Descripción:** Procesa la creación de registros financieros.
- **Funcionalidades:**
  - Valida mes financiero abierto
  - Sube archivos de comprobantes
  - Crea registro financiero con todos los datos
  - Actualiza balance de cuenta de disponibilidad
  - Actualiza maestro de centro de costo
  - Protección de rollback

### Buscar Registros Financieros
- **Archivo:** `src/Financial/applications/financeRecord/FetchingFinanceRecord.ts`
- **Descripción:** Lista paginada de registros financieros.
- **Funcionalidades:**
  - Filtros por tipo de concepto
  - Filtros por cuenta de disponibilidad
  - Filtros por iglesia
  - Filtros por concepto financiero
  - Filtros por rango de fechas

### Cancelar Registro Financiero
- **Archivo:** `src/Financial/applications/financeRecord/CancelFinancialRecord.ts`
- **Descripción:** Anula registros financieros con reversión de movimientos.
- **Funcionalidades:**
  - Valida período financiero abierto
  - Soporta cancelación de registros de EGRESO e INGRESO
  - Crea registro de REVERSIÓN automáticamente
  - Actualiza balance de cuenta de disponibilidad
  - Actualiza maestro de centro de costo (solo para egresos)
  - Cambia estado del registro original a ANULADO
  - Protección de rollback

### Generar Reporte de Registros Financieros
- **Archivo:** `src/Financial/applications/financeRecord/GenerateFinanceRecordReport.ts`
- **Descripción:** Genera reportes detallados de registros financieros.
- **Funcionalidades:**
  - Formato CSV: exportación simple con datos tabulares
  - Formato PDF: incluye resumen, totales por tipo, resultado neto
  - Recolección de todos los registros con paginación transparente
  - Cálculo automático de: total de ingresos, total de egresos, reversiones, resultado neto

### Despachar Actualización de Estado
- **Archivo:** `src/Financial/applications/dispatchers/DispatchUpdateStatusFinancialRecord.ts`
- **Descripción:** Encola actualizaciones de estado de registros financieros.

### Despachar Actualización de Balance de Cuenta
- **Archivo:** `src/Financial/applications/dispatchers/DispatchUpdateAvailabilityAccountBalance.ts`
- **Descripción:** Encola actualizaciones de balance de cuentas de disponibilidad.
- **Funcionalidades:**
  - Para cuentas bancarias, también genera movimiento bancario

### Despachar Actualización de Centro de Costo
- **Archivo:** `src/Financial/applications/dispatchers/DispatchUpdateCostCenterMaster.ts`
- **Descripción:** Encola actualizaciones del maestro de centro de costo.

---

## Contribuciones Online

### Registrar Contribuciones Online
- **Archivo:** `src/Financial/applications/contribution/RegisterContributionsOnline.ts`
- **Descripción:** Registra contribuciones de miembros realizadas online.
- **Funcionalidades:**
  - Valida mes financiero abierto
  - Sube comprobante de transferencia bancaria
  - Crea registro de contribución con datos del miembro y concepto financiero
  - Soporte para vincular con cuenta por cobrar e cuota

### Listar Contribuciones
- **Archivo:** `src/Financial/applications/contribution/ListContributions.ts`
- **Descripción:** Lista paginada de contribuciones.
- **Funcionalidades:**
  - Filtros por rango de fechas
  - Filtros por estado
  - Filtros por miembro
  - Filtros por iglesia
  - Filtros por concepto financiero

### Actualizar Estado de Contribución
- **Archivo:** `src/Financial/applications/contribution/UpdateContributionStatus.ts`
- **Descripción:** Actualiza el estado de contribuciones online.
- **Funcionalidades:**
  - Cambia estado de contribución (PENDIENTE, PROCESADO, RECHAZADO)
  - Cuando se procesa:
    - Actualiza balance de cuenta de disponibilidad
    - Genera registro financiero de INGRESO
    - Si tiene cuenta por cobrar vinculada, procesa el pago

---

## Control Financiero Consolidado

### Generar Meses Financieros
- **Archivo:** `src/ConsolidatedFinancial/applications/GenerateFinancialMonths.ts`
- **Descripción:** Genera los 12 meses financieros del año para una iglesia.

### Validar Mes Financiero
- **Archivo:** `src/ConsolidatedFinancial/applications/FinancialMonthValidator.ts`
- **Descripción:** Valida si un mes financiero está abierto para aceptar movimientos.
- **Funcionalidades:**
  - Busca mes financiero por iglesia, año y mes
  - Lanza excepción si el mes no existe o está cerrado

### Actualizar Mes Financiero
- **Archivo:** `src/ConsolidatedFinancial/applications/FinancialMonth.ts`
- **Descripción:** Abre o cierra meses financieros.
- **Funcionalidades:**
  - Acción CERRAR: cierra el mes financiero
  - Acción ABRIR: reabre el mes financiero

---

## Sistema Bancario

### Crear o Actualizar Banco
- **Archivo:** `src/Banking/applications/CreateOrUpdateBank.ts`
- **Descripción:** Gestiona configuraciones bancarias vinculadas a iglesias.
- **Funcionalidades:**
  - Crea nuevo banco con: tipo de cuenta, nombre, tag, dirección de pago instantáneo, instrucciones bancarias
  - Actualiza banco existente
  - Valida existencia de la iglesia

### Buscar Banco por ID
- **Archivo:** `src/Banking/applications/FinBankByBankId.ts`
- **Descripción:** Obtiene detalles de un banco específico.

### Listar Bancos por Iglesia
- **Archivo:** `src/Banking/applications/SearchBankByChurchId.ts`
- **Descripción:** Lista cuentas bancarias de una congregación.

### Registrar Movimiento Bancario (Job)
- **Archivo:** `src/Banking/applications/MovementBankRecord.job.ts`
- **Descripción:** Procesa y registra movimientos bancarios.
- **Funcionalidades:**
  - Crea registro de movimiento con: monto, operación (DEPÓSITO/RETIRO), concepto, banco, fecha

---

## Conciliación Bancaria

### Importar Extracto Bancario
- **Archivo:** `src/Banking/applications/bankStatement/ImportBankStatement.ts`
- **Descripción:** Encola importación de extractos bancarios.
- **Funcionalidades:**
  - Valida cuenta de disponibilidad vinculada al banco
  - Persiste archivo temporal
  - Encola procesamiento en cola de trabajo

### Listar Extractos Bancarios
- **Archivo:** `src/Banking/applications/bankStatement/ListBankStatements.ts`
- **Descripción:** Lista paginada de extractos bancarios.
- **Funcionalidades:**
  - Filtros por iglesia
  - Filtros por banco
  - Filtros por estado de conciliación
  - Filtros por mes y año
  - Filtros por rango de fechas

### Conciliar Extracto Bancario
- **Archivo:** `src/Banking/applications/BankStatementReconciler.ts`
- **Descripción:** Auto-concilia extractos bancarios con registros financieros.
- **Funcionalidades:**
  - Busca registro financiero coincidente por: iglesia, monto, fecha (±1 día), tipo, cuenta de disponibilidad
  - Si encuentra coincidencia: marca como CONCILIADO y vincula registro financiero
  - Si no encuentra: marca como NO CONCILIADO para conciliación manual

### Vincular Extracto a Registro Financiero
- **Archivo:** `src/Banking/applications/bankStatement/LinkBankStatementToFinancialRecord.ts`
- **Descripción:** Vincula manualmente un extracto bancario a un registro financiero.
- **Funcionalidades:**
  - Valida existencia del extracto y registro financiero
  - Actualiza estado a CONCILIADO
  - Actualiza estado del registro financiero a CONCILIADO

### Reintentar Conciliación
- **Archivo:** `src/Banking/applications/bankStatement/RetryBankStatementReconciliation.ts`
- **Descripción:** Reintenta la conciliación automática de un extracto.

---

## Compras

### Registrar Compra
- **Archivo:** `src/Purchases/applications/RecordPurchase.ts`
- **Descripción:** Registra órdenes de compra.
- **Funcionalidades:**
  - Valida cuenta de disponibilidad y centro de costo
  - Crea registro de compra con: concepto financiero, fecha, total, impuesto, descripción, factura, items
  - Genera registro financiero de EGRESO automáticamente
  - Estado del registro según tipo de cuenta (COMPENSADO para caja, LIQUIDADO para banco)

### Buscar Compras
- **Archivo:** `src/Purchases/applications/SearchPurchase.ts`
- **Descripción:** Lista paginada de compras.
- **Funcionalidades:**
  - Filtros por iglesia
  - Filtros por rango de fechas de compra

---

## Patrimonio (Gestión de Activos)

### Crear Activo
- **Archivo:** `src/Patrimony/applications/CreateAsset.ts`
- **Descripción:** Registra nuevos activos patrimoniales.
- **Funcionalidades:**
  - Valida miembro responsable
  - Configura: código, nombre, categoría, fecha de adquisición, valor, cantidad, ubicación, estado
  - Soporte para adjuntos (archivos)
  - Registro de auditoría (quién realizó la acción, notas)

### Actualizar Activo
- **Archivo:** `src/Patrimony/applications/UpdateAsset.ts`
- **Descripción:** Actualiza activos existentes.
- **Funcionalidades:**
  - Actualiza todos los campos del activo
  - Gestión de adjuntos: agregar nuevos, eliminar existentes
  - Valida miembro responsable si se actualiza
  - Registro de auditoría

### Obtener Activo
- **Archivo:** `src/Patrimony/applications/GetAsset.ts`
- **Descripción:** Obtiene detalles de un activo específico.

### Listar Activos
- **Archivo:** `src/Patrimony/applications/ListAssets.ts`
- **Descripción:** Lista paginada de activos patrimoniales.
- **Funcionalidades:**
  - Filtros por iglesia
  - Filtros por categoría
  - Filtros por estado
  - Búsqueda por: nombre, código, responsable, ubicación

### Dar de Baja Activo
- **Archivo:** `src/Patrimony/applications/DisposeAsset.ts`
- **Descripción:** Marca activos como dados de baja.
- **Funcionalidades:**
  - Configura: estado de baja, motivo, observaciones, fecha de baja
  - Registro de auditoría

### Registrar Inventario de Activo
- **Archivo:** `src/Patrimony/applications/RecordAssetInventory.ts`
- **Descripción:** Registra verificación física de inventario para un activo.
- **Funcionalidades:**
  - Marca activo como inventariado
  - Configura: estado de inventario (CONFIRMADO/NO ENCONTRADO), notas, código, cantidad

### Procesar Inventario desde Archivo (Job)
- **Archivo:** `src/Patrimony/applications/ProcessInventoryFromFile.job.ts`
- **Descripción:** Procesa importación masiva de inventario desde CSV.
- **Funcionalidades:**
  - Lee archivo CSV con detección automática de delimitador
  - Procesa cada fila actualizando el activo correspondiente
  - Genera resumen: procesados, actualizados, omitidos, errores
  - Envía email de resumen al usuario que realizó la importación
  - Elimina archivo temporal al finalizar

### Generar Reporte de Inventario
- **Archivo:** `src/Patrimony/applications/GenerateInventoryReport.ts`
- **Descripción:** Genera reportes de inventario patrimonial.
- **Funcionalidades:**
  - Formato CSV: exportación simple con datos tabulares
  - Formato PDF: incluye resumen (total de activos, valor total, por estado, documentos pendientes)
  - Filtros por categoría y estado

### Generar Hoja de Inventario Físico
- **Archivo:** `src/Patrimony/applications/GeneratePhysicalInventorySheet.ts`
- **Descripción:** Genera CSV para verificación física de inventario.
- **Funcionalidades:**
  - Incluye todos los activos con columnas para completar durante verificación
  - Columnas: ID, código, nombre, categoría, responsable, ubicación, estado actual, cantidad, última verificación, resultado, código inventario, cantidad inventario, estado inventario, observaciones

---

## Reportes y Analíticas

### Diezmos Mensuales
- **Archivo:** `src/Reports/applications/MonthlyTithes.ts`
- **Descripción:** Genera resumen mensual de diezmos.
- **Funcionalidades:**
  - Valida existencia de la iglesia
  - Obtiene lista de diezmos del repositorio de registros financieros

### Estado de Resultados (Income Statement)
- **Archivo:** `src/Reports/applications/IncomeStatement.ts`
- **Descripción:** Genera estado de resultados financiero.
- **Funcionalidades:**
  - Calcula totales de cuentas de disponibilidad (balance, ingresos, egresos)
  - Calcula totales de centros de costo
  - Desglosa por categoría de estado (REVENUE, COGS, OPEX, MINISTRY_TRANSFERS, CAPEX, OTHER)
  - Calcula: ingresos totales, gastos operativos, ingresos operativos, resultado neto
  - Incluye snapshot de flujo de caja

### DRE (Demonstrativo de Resultados del Ejercicio)
- **Archivo:** `src/Reports/applications/DRE.ts`
- **Descripción:** Genera DRE detallado.
- **Funcionalidades:**
  - Busca DRE existente en caché o genera nuevo
  - Calcula: ingresos brutos, costos directos, gastos operacionales, transferencias ministeriales, inversiones CAPEX, resultados extraordinarios
  - Calcula: ingresos netos, ganancia bruta, resultado operacional, resultado neto
  - Guarda DRE generado para consultas futuras

---

## Sistema de Seguridad y Autenticación

### Iniciar Sesión
- **Archivo:** `src/SecuritySystem/applications/MakeLogin.ts`
- **Descripción:** Autentica usuarios y genera tokens JWT.
- **Funcionalidades:**
  - Valida existencia del usuario por email
  - Valida que el usuario esté activo
  - Valida contraseña con encriptación
  - Actualiza fecha de último login
  - Genera token JWT con: churchId, userId, email, name, memberId

### Crear o Actualizar Usuario
- **Archivo:** `src/SecuritySystem/applications/CreateOrUpdateUser.ts`
- **Descripción:** Gestiona usuarios del sistema.
- **Funcionalidades:**
  - Crea nuevos usuarios con contraseña encriptada
  - Actualiza usuarios existentes (email, estado activo/inactivo)
  - Vincula usuario a miembro si se proporciona memberId

### Crear Usuario para Miembro (Job)
- **Archivo:** `src/SecuritySystem/applications/CreateUserForMember.job.ts`
- **Descripción:** Crea automáticamente usuario para nuevos miembros.
- **Funcionalidades:**
  - Verifica si ya existe usuario con el email del miembro
  - Crea usuario con contraseña inicial = DNI sin puntos ni guiones

### Cambiar Contraseña
- **Archivo:** `src/SecuritySystem/applications/ChangePassword.ts`
- **Descripción:** Permite cambiar contraseña de usuarios.
- **Funcionalidades:**
  - Valida existencia del usuario por email
  - Encripta nueva contraseña
  - Actualiza contraseña en base de datos

### Listar Usuarios
- **Archivo:** `src/SecuritySystem/applications/finder/FetchAllUsers.ts`
- **Descripción:** Lista paginada de usuarios.
- **Funcionalidades:**
  - Filtros por isSuperuser
  - Filtros por isActive
  - Excluye contraseñas de la respuesta

---

## Control de Acceso Basado en Roles (RBAC)

### Crear Rol
- **Archivo:** `src/SecuritySystem/applications/rbac/CreateRole.ts`
- **Descripción:** Crea nuevos roles de seguridad.
- **Funcionalidades:**
  - Valida que no exista rol con el mismo nombre en la iglesia
  - Configura: nombre y descripción del rol

### Listar Roles
- **Archivo:** `src/SecuritySystem/applications/rbac/ListRoles.ts`
- **Descripción:** Lista todos los roles de una iglesia.

### Listar Permisos
- **Archivo:** `src/SecuritySystem/applications/rbac/ListPermissions.ts`
- **Descripción:** Lista todos los permisos del catálogo.

### Asignar Permisos a Rol
- **Archivo:** `src/SecuritySystem/applications/rbac/AssignPermissionsToRole.ts`
- **Descripción:** Asigna permisos a un rol específico.
- **Funcionalidades:**
  - Valida existencia del rol en la iglesia
  - Valida existencia de todos los permisos
  - Reemplaza permisos del rol (no acumula)

### Obtener Permisos de Rol
- **Archivo:** `src/SecuritySystem/applications/rbac/GetRolePermissions.ts`
- **Descripción:** Obtiene rol con todos sus permisos asociados.

### Asignar Roles a Usuario
- **Archivo:** `src/SecuritySystem/applications/rbac/AssignRolesToUser.ts`
- **Descripción:** Asigna roles a un usuario.
- **Funcionalidades:**
  - Valida existencia de todos los roles en la iglesia
  - Asigna roles únicos
  - Invalida caché de autorización del usuario

### Obtener Permisos de Usuario
- **Archivo:** `src/SecuritySystem/applications/rbac/GetUserPermissions.ts`
- **Descripción:** Obtiene todos los permisos de un usuario (derivados de sus roles).

### Servicio de Autorización
- **Archivo:** `src/SecuritySystem/applications/rbac/AuthorizationService.ts`
- **Descripción:** Resuelve autorización de usuarios con caché.
- **Funcionalidades:**
  - Busca roles asignados al usuario
  - Obtiene permisos de cada rol
  - Genera contexto de autorización: roles y permisos (módulo:acción)
  - Caché de 5 minutos para mejorar rendimiento

### Bootstrap de Permisos (Job)
- **Archivo:** `src/SecuritySystem/applications/rbac/Jobs/BootstrapPermissions.job.ts`
- **Descripción:** Inicializa permisos y roles base para una iglesia.
- **Funcionalidades:**
  - Crea catálogo de permisos base si no existen
  - Crea roles base (ADMIN, etc.) para la iglesia
  - Asigna permisos a roles base
  - Opcionalmente crea usuario y asigna rol ADMIN

---

## Notificaciones y Comunicaciones

### Enviar Email de Cambio de Contraseña
- **Archivo:** `src/SendMail/applications/SendMailChangePassword.ts`
- **Descripción:** Envía email con nueva contraseña temporal.
- **Funcionalidades:**
  - Encola email con template de recuperación de contraseña
  - Incluye contraseña temporal en el contexto

### Enviar Email de Compromiso de Pago
- **Archivo:** `src/SendMail/applications/SendMailPaymentCommitment.ts`
- **Descripción:** Envía email de compromiso de pago.
- **Funcionalidades:**
  - Encola email con template de compromiso de pago
  - Incluye: monto, cuotas, concepto, fecha de vencimiento, token, datos del deudor y la iglesia

---

## Catálogos Geográficos

### Obtener Estados por País
- **Archivo:** `src/World/applications/FindStateByCountryId.ts`
- **Descripción:** Recupera lista de estados/provincias de un país.

---

## Trabajos en Cola (Background Jobs)

### Jobs de Registros Financieros
- `CreateFinancialRecordJob`: Crea registros financieros con validaciones y rollback
- `UpdateAvailabilityAccountBalanceJob`: Actualiza balances de cuentas de disponibilidad
- `UpdateCostCenterMasterJob`: Actualiza maestros de centros de costo
- `RebuildAvailabilityMasterAccountJob`: Reconstruye maestros de cuentas de disponibilidad
- `RebuildCostCenterMasterJob`: Reconstruye maestros de centros de costo
- `UpdateFinancialRecordJob`: Actualiza estado de registros financieros

### Jobs de Banking
- `MovementBankRecordJob`: Registra movimientos bancarios
- `ImportBankStatementJob`: Procesa importación de extractos bancarios

### Jobs de Seguridad
- `CreateUserForMemberJob`: Crea usuarios automáticamente para miembros
- `BootstrapPermissionsJob`: Inicializa permisos y roles para iglesias

### Jobs de Patrimonio
- `ProcessInventoryFromFileJob`: Procesa importación de inventario desde CSV

### Jobs de Comunicaciones
- `SendMailJob`: Envía emails con templates

---

## Utilidades Compartidas

### Pago de Cuotas
- **Archivo:** `src/Shared/applications/PayInstallment.ts`
- **Descripción:** Función utilitaria para procesar pagos de cuotas.
- **Funcionalidades:**
  - Valida si la cuota ya está pagada
  - Calcula si el pago es parcial o total
  - Actualiza: estado, monto pendiente, monto pagado
  - Retorna el monto sobrante para siguiente cuota

---

## Arquitectura Técnica

### Stack Tecnológico
- **Runtime:** Node.js con TypeScript
- **Framework Web:** Express.js (sin decoradores)
- **Base de Datos:** MongoDB con driver nativo
- **Consultas:** `@abejarano/ts-mongodb-criteria` para DDD
- **Colas:** Bull con Redis
- **Autenticación:** JWT
- **Logging:** Pino
- **Generación PDF:** Puppeteer
- **Exportación Excel:** Adapters XLS personalizados

### Patrones de Diseño
- **Domain-Driven Design (DDD):** Separación clara de domain, application, infrastructure
- **Repository Pattern:** Abstracción de persistencia
- **Unit of Work:** Transacciones con rollback
- **CQRS ligero:** Separación de lectura/escritura con dispatchers
- **Event-Driven:** Procesamiento asíncrono con colas

### Módulos del Sistema
1. **AccountsPayable:** Gestión de cuentas por pagar
2. **AccountsReceivable:** Gestión de cuentas por cobrar
3. **Banking:** Sistema bancario y conciliación
4. **Church:** Gestión de iglesias, miembros y ministros
5. **ConsolidatedFinancial:** Control de períodos financieros
6. **Financial:** Configuración financiera (conceptos, cuentas, centros de costo, registros)
7. **Patrimony:** Gestión de activos patrimoniales
8. **Purchases:** Sistema de compras
9. **Reports:** Reportes y analíticas
10. **SecuritySystem:** Autenticación y RBAC
11. **SendMail:** Notificaciones por email
12. **World:** Catálogos geográficos
13. **Shared:** Utilidades y adaptadores comunes
