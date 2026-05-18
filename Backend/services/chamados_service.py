"""
Serviços de envio para Metal Frio (email) e Fricon (API NeoAssist).
"""
import os, smtplib, requests
from email.mime.multipart import MIMEMultipart
from email.mime.text      import MIMEText
from datetime import date, timedelta

GMAIL_USER     = os.getenv("GMAIL_USER", "chamados.premiumvc@gmail.com")
GMAIL_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")
METALFRIO_EMAILS = [
    e.strip() for e in os.getenv(
        "METALFRIO_EMAILS",
        "santospcm@metalfrio.com.br,atendecliente@metalfrio.com.br,"
        "souzamar@metalfrio.com.br,pattucci@metalfrio.com.br,wulf@metalfrio.com.br"
    ).split(",")
]
FRICON_BASE64 = os.getenv("FRICON_BASE64", "")
FRICON_API_URL = "https://fricon.neoassist.com/API/interactions.json"
RCA_NOME      = os.getenv("RCA_NOME",     "Allan (Chamar no whatsapp de preferencia)")
RCA_FONE      = os.getenv("RCA_FONE",     "77 8113-3914")
EMPRESA_EMAIL = os.getenv("EMPRESA_EMAIL","premiumdistribuidora.ti@gmail.com")
EMPRESA_CNPJ  = os.getenv("EMPRESA_CNPJ", "04.831.827/0001-06")


def _ultima_terca() -> str:
    today = date.today()
    days_back = (today.weekday() - 1) % 7
    terca = today - timedelta(days=days_back if days_back else 7)
    return terca.strftime("%d/%m/%Y")


def enviar_metalfrio(dados: dict) -> str:
    rca_nome = dados.get("rca_nome") or RCA_NOME
    rca_fone = dados.get("rca_fone") or RCA_FONE
    corpo = (
        f"RG\t{dados['rg_freezer']}\n"
        f"Modelo\t{dados.get('modelo','VF50A')}\n"
        f"Voltagem\t{dados.get('voltagem','220')}\n"
        f"Cliente\t{dados['cod_cliente']}\n"
        f"FANTASIA\t{dados.get('nome_cliente','')}\n"
        f"CNPJ\t{dados.get('cnpj','')}\n"
        f"Endereço\t{dados.get('endereco','')}\n"
        f"Bairro\t{dados.get('bairro','')}\n"
        f"Cidade\t{dados.get('cidade','')}\n"
        f"CEP\t{dados.get('cep','')}\n"
        f"N°\t{dados.get('numero','')}\n"
        f"Contato\t{rca_nome} - {rca_fone}"
    )
    msg = MIMEMultipart()
    msg["From"]    = GMAIL_USER
    msg["To"]      = ", ".join(METALFRIO_EMAILS)
    msg["Subject"] = f"Chamado Freezer - {dados.get('nome_cliente','')} - {dados['rg_freezer']}"
    msg.attach(MIMEText(corpo, "plain", "utf-8"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(GMAIL_USER, GMAIL_PASSWORD)
        smtp.sendmail(GMAIL_USER, METALFRIO_EMAILS, msg.as_string())
    return f"MF-{date.today().strftime('%Y%m%d')}-{dados['rg_freezer'].replace('-','')}"


def enviar_fricon(dados: dict) -> str:
    defeito   = dados.get("defeito", "")
    horario   = dados.get("horario", "")
    ponto_ref = dados.get("ponto_ref", "")
    rca_nome  = dados.get("rca_nome") or RCA_NOME
    rca_fone  = dados.get("rca_fone") or RCA_FONE
    question_body = (
        f" <br> Produto está em comodato?: Sim"
        f" <br> CPF/CNPJ: {dados.get('cnpj','')}"
        f" <br> E-mail: {EMPRESA_EMAIL}"
        f" <br> Razão Social/Nome: {dados.get('nome_cliente','')}"
        f" <br> CEP: {dados.get('cep','')}"
        f" <br> Endereço: {dados.get('endereco','')}"
        f" <br> Nº: {dados.get('numero','')}"
        f" <br> Bairro: {dados.get('bairro','')}"
        f" <br> Cidade: {dados.get('cidade','')}"
        f" <br> Estado: BA"
        f" <br> Telefone de Contato: {rca_fone}"
        f" <br> Pessoa de Contato: {rca_nome}"
        f" <br> O equipamento está ligado e conectado corretamente à tomada?: Sim"
        f" <br> O produto abastecido no equipamento entra com temperatura ambiente, "
        f"refrigerado ou congelado?: Congelado"
        f" <br> Quando foi feito o último abastecimento?: {_ultima_terca()}"
        f" <br> Houve queda de energia recentemente?: Não"
        f" <br> Gentileza especificar:: {defeito}"
        f"<br>Mensagem: <br>{defeito} deve ser aberto com urgência "
        f"(DEVIDO CONTRATO ENTRE AS EMPRESAS SEM NECESSIDADE DE NFE)\n"
        f"Ponto de Referência: {ponto_ref}\n"
        f"Horário de Atendimento: {horario}"
    )
    headers = {
        "accept":       "application/json, text/plain, */*",
        "content-type": "application/x-www-form-urlencoded",
        "origin":       "https://cdn.atendimen.to",
        "referer":      "https://cdn.atendimen.to/",
        "user-agent":   "Mozilla/5.0",
    }
    payload = {
        "contact_id":                          "0",
        "interaction_fields[EMail]":           EMPRESA_EMAIL,
        "interaction_fields[Name]":            "Premium",
        "interaction_fields[category_id]":     "569726",
        "interaction_fields[question]":        question_body,
        "interaction_fields[responseKey]":     "",
        "interaction_fields[FieldA]":          f"({rca_fone[:2]}) {rca_fone[3:]}",
        "interaction_fields[FieldU]":          EMPRESA_CNPJ,
        "interaction_fields[ProtocoloFieldA]": dados["rg_freezer"],
        "attachments[0][idx]":                 "0",
        "attachments[0][nome]":                "blank.pdf",
        "attachments[0][base64]":              FRICON_BASE64,
        "interaction_type":                    "1",
        "interaction_subtype":                 "1",
    }
    resp = requests.post(FRICON_API_URL, headers=headers, data=payload, timeout=30)
    resp.raise_for_status()
    j = resp.json()
    if j.get("success"):
        return str(j["interaction"]["interaction_id"])
    raise Exception(f"Fricon erro: {j}")
