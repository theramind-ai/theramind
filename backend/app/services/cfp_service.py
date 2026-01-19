import httpx
from loguru import logger
from typing import Optional, Dict, Any

class CFPService:
    BASE_URL = "https://cadastro.cfp.org.br/api/profissionais/pesquisar"
    
    @staticmethod
    async def validate_crp(registro: str, uf: str) -> Dict[str, Any]:
        """
        Consulta o Cadastro Nacional de Psicólogos do CFP.
        """
        # Limpa o registro para remover pontos, traços ou barras se vierem do frontend
        registro_clean = "".join(filter(str.isdigit, registro))
        uf_clean = "".join(filter(str.isdigit, uf)) # Assume que UF pode vir como "04"
        
        headers = {
            "Content-Type": "application/json",
            "Referer": "https://cadastro.cfp.org.br/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        payload = {
            "registro": registro_clean,
            "uf": uf_clean
        }
        
        logger.info(f"Consultando CFP para CRP {registro_clean} na região {uf_clean}")
        
        try:
            async with httpx.AsyncClient() as client:
                # Nota: Este endpoint pode variar ou requerer tokens. 
                # Se falhar 404, precisaremos do endpoint exato do portal de transparência.
                response = await client.post(CFPService.BASE_URL, json=payload, headers=headers, timeout=10.0)
                
                if response.status_code == 200:
                    data = response.json()
                    # A estrutura comum retornada é uma lista de profissionais
                    # Exemplo: [{"situacao": "ATIVO", "Nome": "ISA LETICIA MELO", ...}]
                    if isinstance(data, list) and len(data) > 0:
                        prof = data[0]
                        return {
                            "valid": True,
                            "name": prof.get("Nome"),
                            "status": prof.get("situacao"),
                            "region": prof.get("nomeregional"),
                            "raw": prof
                        }
                    return {"valid": False, "error": "Profissional não encontrado no CFP"}
                
                logger.warning(f"CFP API retornou status {response.status_code}")
                return {"valid": False, "error": f"Erro na consulta externa (Status {response.status_code})"}
                
        except Exception as e:
            logger.error(f"Erro ao consultar CFP: {e}")
            return {"valid": False, "error": "Serviço de consulta CFP temporariamente indisponível"}

    @staticmethod
    def parse_crp_input(crp_str: str):
        """
        Tenta extrair Região e Número do input do usuário (ex: '04/44606' ou 'CRP 04/44606')
        """
        import re
        # Busca padrões como 04/44606 ou 4/44606
        match = re.search(r"(\d{1,2})[/\s](\d+)", crp_str)
        if match:
            return match.group(1).zfill(2), match.group(2)
        return None, None
