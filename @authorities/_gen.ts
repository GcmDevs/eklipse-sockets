const code = '001';

const subs = {
  chat: `${code}004`,
  pacientes: `${code}005`,
  eventos: `${code}006`,
};

export const GEN_AUTHS = {
  code,
  chat: {
    code: subs.chat,
    relacionesChatUsuario: `${subs.chat}001`,
    relacionesChatPaciente: `${subs.chat}002`,
    relacionesChatAll: `${subs.chat}003`,
  },
  pacientes: {
    code: subs.pacientes,
    habilitarPacienteApp: `${subs.pacientes}001`,
    addPacienteToArea: `${subs.pacientes}002`,
  },
  eventos: {
    code: subs.eventos,
    addEventosPacientes: `${subs.eventos}001`,
  },
};
