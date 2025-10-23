# Accounts Payable payload cookbook

This guide recopila ejemplos de cuerpos JSON para consumir el endpoint `POST /accounts-payable` desde Postman.
El `PermissionMiddleware` incorpora automáticamente el `churchId` a partir del token de sesión, por lo que los ejemplos omiten ese campo en el body; el backend lo completa de forma transparente. Ajusta los valores de identificadores y fechas a tus datos reales.

> **Cabeceras:** `Content-Type: application/json`. Recuerda adjuntar el encabezado de autorización que habilita el middleware.

## Escenario A · Única NF con pagos parcelados

### A1. NF isenta (sin impuestos destacados)
```json
{
  "supplierId": "urn:supplier:987654321",
  "description": "Reforma do altar",
  "installments": [
    { "amount": 15000, "dueDate": "2024-10-10" },
    { "amount": 15000, "dueDate": "2024-11-10" }
  ],
  "taxMetadata": {
    "status": "EXEMPT",
    "taxExempt": true,
    "exemptionReason": "Serviço vinculado à finalidade essencial do templo"
  }
}
```

### A2. NF com impostos retidos (taxExempt = false)
```json
{
  "supplierId": "urn:supplier:987654321",
  "description": "Serviço de manutenção elétrica",
  "installments": [
    { "amount": 500, "dueDate": "2024-08-05" },
    { "amount": 500, "dueDate": "2024-09-05" }
  ],
  "taxes": [
    { "taxType": "ISS", "percentage": 5, "amount": 50, "status": "TAXED" },
    { "taxType": "INSS", "percentage": 11, "amount": 110, "status": "TAXED" }
  ],
  "taxMetadata": {
    "status": "TAXED",
    "taxExempt": false,
    "observation": "Retenções calculadas conforme legislação municipal"
  }
}
```

### A3. NF com impostos mistos (retenção direta + substituição)
```json
{
  "supplierId": "urn:supplier:987654321",
  "description": "Serviço de iluminação do templo",
  "installments": [
    { "amount": 8000, "dueDate": "2024-08-15" },
    { "amount": 8000, "dueDate": "2024-09-15" }
  ],
  "taxes": [
    { "taxType": "ISS", "percentage": 3, "amount": 240, "status": "TAXED" },
    { "taxType": "ICMS-ST", "percentage": 8, "amount": 640, "status": "SUBSTITUTION" }
  ],
  "taxMetadata": {
    "status": "TAXED",
    "taxExempt": false,
    "observation": "Nota fiscal com retenção direta e substituição tributária"
  }
}
```

## Escenario B · Uma NF por registro (sem parcelas)

### B1. NF individual isenta
```json
{
  "supplierId": "urn:supplier:246813579",
  "description": "Pagamento NF #2024-045",
  "amountTotal": 3200,
  "taxMetadata": {
    "status": "EXEMPT",
    "taxExempt": true,
    "exemptionReason": "Prestador enquadrado como MEI sem destaque de tributos"
  }
}
```

### B2. NF individual com impostos retidos
```json
{
  "supplierId": "urn:supplier:246813579",
  "description": "Pagamento NF #2024-046",
  "amountTotal": 4500,
  "taxes": [
    { "taxType": "ISS", "percentage": 5, "amount": 225, "status": "TAXED" }
  ],
  "taxMetadata": {
    "status": "TAXED",
    "taxExempt": false,
    "cstCode": "01",
    "cfop": "5933",
    "observation": "Retenção de ISS conforme contrato de serviços"
  }
}
```

### B3. NF individual apenas com substituição tributária
```json
{
  "supplierId": "urn:supplier:246813579",
  "description": "Pagamento NF #2024-047",
  "amountTotal": 7800,
  "taxes": [
    { "taxType": "ICMS-ST", "percentage": 12, "amount": 936, "status": "SUBSTITUTION" }
  ],
  "taxMetadata": {
    "status": "SUBSTITUTION",
    "taxExempt": false,
    "observation": "Fornecedor sob regime de substituição tributária"
  }
}
```

## Notas adicionales

- Define `taxMetadata.taxExempt` en `true` únicamente cuando a NF é isenta; o validador HTTP rejeitará linhas de imposto nesse caso.
- Se `taxMetadata.taxExempt` for `false`, pelo menos uma entrada em `taxes` deve estar presente e o sistema calculará `taxAmountTotal` automaticamente.
- No cenário B (`installments` omitido), `amountTotal` é obrigatório. Caso envie parcelas, o total é deduzido da soma das parcelas.
- Os campos opcionais `exemptionReason`, `cstCode`, `cfop` e `observation` ajudam a documentação de auditoria, mas podem ser omitidos quando não se aplicam.
