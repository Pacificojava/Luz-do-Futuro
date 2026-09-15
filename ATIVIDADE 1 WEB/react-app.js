const { useState } = React;

const API_URL = '/api/aneel';
const RESOURCE_ID = 'fcf2906c-7c32-4b9b-a637-054e7a5234f4';

const estados = [
  ['AC', 'Acre'], ['AL', 'Alagoas'], ['AP', 'Amapá'], ['AM', 'Amazonas'],
  ['BA', 'Bahia'], ['CE', 'Ceará'], ['DF', 'Distrito Federal'], ['ES', 'Espírito Santo'],
  ['GO', 'Goiás'], ['MA', 'Maranhão'], ['MT', 'Mato Grosso'], ['MS', 'Mato Grosso do Sul'],
  ['MG', 'Minas Gerais'], ['PA', 'Pará'], ['PB', 'Paraíba'], ['PR', 'Paraná'],
  ['PE', 'Pernambuco'], ['PI', 'Piauí'], ['RJ', 'Rio de Janeiro'], ['RN', 'Rio Grande do Norte'],
  ['RS', 'Rio Grande do Sul'], ['RO', 'Rondônia'], ['RR', 'Roraima'], ['SC', 'Santa Catarina'],
  ['SP', 'São Paulo'], ['SE', 'Sergipe'], ['TO', 'Tocantins']
];

const distribuidorasPorEstado = {
  AC: ['Energisa Acre', 'EAC'], AL: ['Equatorial Alagoas', 'EAL'],
  AP: ['CEA', 'Companhia de Eletricidade do Amapá'], AM: ['Amazonas Energia', 'AME'],
  BA: ['Neoenergia Coelba', 'COELBA'], CE: ['ENEL CE', 'Enel Distribuição Ceará'],
  DF: ['Neoenergia Brasília', 'CEB'], ES: ['EDP Espírito Santo', 'EDP ES'],
  GO: ['Equatorial Goiás', 'CELG'], MA: ['Equatorial Maranhão', 'CEMAR'],
  MT: ['Energisa Mato Grosso', 'EMT'], MS: ['Energisa Mato Grosso do Sul', 'EMS'],
  MG: ['CEMIG-D', 'CEMIG'], PA: ['Equatorial Pará', 'CELPA'], PB: ['Energisa Paraíba', 'EPB'],
  PR: ['Copel', 'COPEL-DIS'], PE: ['Neoenergia Pernambuco', 'CELPE'], PI: ['Equatorial Piauí', 'CEPISA'],
  RJ: ['ENEL RJ', 'Light'], RN: ['Neoenergia Cosern', 'COSERN'], RS: ['CEEE', 'RGE'],
  RO: ['Energisa Rondônia', 'ERO'], RR: ['Roraima Energia', 'Boa Vista'], SC: ['Celesc', 'CELESC'],
  SP: ['ENEL SP', 'CPFL PAULISTA'], SE: ['Energisa Sergipe', 'ESE'], TO: ['Energisa Tocantins', 'ETO']
};

function converterValor(valor) {
  return Number(String(valor || '').replace(/\./g, '').replace(',', '.'));
}

async function buscarTarifa(uf) {
  if (uf === 'MA') {
    return {
      valor: 0.889,
      distribuidora: 'Equatorial Maranhão'
    };
  }

  for (const distribuidora of distribuidorasPorEstado[uf]) {
    const params = new URLSearchParams({
      resource_id: RESOURCE_ID,
      q: distribuidora,
      limit: '1000',
      sort: 'DatInicioVigencia desc'
    });
    const resposta = await fetch(`${API_URL}?${params}`);
    if (!resposta.ok) throw new Error('A API da ANEEL não respondeu.');

    const dados = await resposta.json();
    const registro = dados.result.records.find((item) =>
      item.DscBaseTarifaria === 'Tarifa de Aplicação' &&
      item.DscSubGrupo === 'B1' && item.DscClasse === 'Residencial' &&
      item.DscSubClasse === 'Residencial' && item.DscUnidadeTerciaria === 'MWh'
    );
    if (registro) {
      return {
        valor: (converterValor(registro.VlrTUSD) + converterValor(registro.VlrTE)) / 1000,
        distribuidora: registro.SigAgente
      };
    }
  }
  throw new Error('Não foi encontrada tarifa residencial para este estado.');
}

function Campo({ label, children }) {
  return <label className="campo">{label}{children}</label>;
}

function FormularioCalculadora({ onResultado }) {
  const [dados, setDados] = useState({ aparelho: '', potencia: '', horas: '', dias: '', estado: '' });
  const [tarifa, setTarifa] = useState(null);
  const [status, setStatus] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function selecionarEstado(event) {
    const uf = event.target.value;
    setDados({ ...dados, estado: uf });
    setTarifa(null);
    if (!uf) return;
    setCarregando(true);
    setStatus('Consultando a API da ANEEL...');
    try {
      const encontrada = await buscarTarifa(uf);
      setTarifa(encontrada);
      setStatus(`Tarifa de ${encontrada.distribuidora}: ${encontrada.valor.toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 3, maximumFractionDigits: 3
      })}/kWh`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setCarregando(false);
    }
  }

  function atualizarCampo(event) {
    setDados({ ...dados, [event.target.name]: event.target.value });
  }

  function calcular(event) {
    event.preventDefault();
    if (!tarifa) return setStatus('Selecione o estado e aguarde a tarifa ser carregada.');
    const consumo = (Number(dados.potencia) / 1000) * Number(dados.horas) * Number(dados.dias);
    onResultado({ aparelho: dados.aparelho, consumo, custo: consumo * tarifa.valor });
  }

  return <form onSubmit={calcular}>
    <Campo label="Aparelho:"><input name="aparelho" placeholder="Ex.: Geladeira" value={dados.aparelho} onChange={atualizarCampo} required /></Campo>
    <Campo label="Potência (watts):"><input name="potencia" type="number" min="0" step="any" placeholder="Ex.: 150" value={dados.potencia} onChange={atualizarCampo} required /></Campo>
    <Campo label="Horas de uso por dia:"><input name="horas" type="number" min="0" max="24" step="any" value={dados.horas} onChange={atualizarCampo} required /></Campo>
    <Campo label="Dias de uso:"><input name="dias" type="number" min="0" max="31" value={dados.dias} onChange={atualizarCampo} required /></Campo>
    <Campo label="Estado:"><select value={dados.estado} onChange={selecionarEstado} required><option value="">Selecione seu estado</option>{estados.map(([uf, nome]) => <option key={uf} value={uf}>{nome} ({uf})</option>)}</select></Campo>
    <p role="status" aria-live="polite">{status}</p>
    <button type="submit" disabled={carregando}>Calcular</button>
  </form>;
}

function Calculadora() {
  const [resultado, setResultado] = useState(null);
  return <><h2>Calculadora de Consumo</h2><FormularioCalculadora onResultado={setResultado} />
    {resultado && <div id="resultado-calculadora" role="status"><h3>Resultado para {resultado.aparelho}</h3><p>Consumo estimado: <strong>{resultado.consumo.toFixed(2)} kWh por período</strong></p><p>Custo estimado: <strong>{resultado.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p></div>}
  </>;
}

ReactDOM.createRoot(document.querySelector('#calculadora-react')).render(<Calculadora />);