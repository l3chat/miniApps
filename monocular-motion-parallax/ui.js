export const MODE_TEXT={
  ru:{training:'Training',experiment:'Experiment',experimentSoon:'Experiment: каркас готов, измерительная логика — следующий этап',unresolved:'Нераспознано'},
  en:{training:'Training',experiment:'Experiment',experimentSoon:'Experiment scaffold ready; measurement logic is the next step',unresolved:'Unresolved'},
  de:{training:'Training',experiment:'Experiment',experimentSoon:'Experiment-Grundgerüst ist bereit; die Messlogik folgt als nächster Schritt',unresolved:'Nicht erkannt'},
  uk:{training:'Training',experiment:'Experiment',experimentSoon:'Каркас Experiment готовий; вимірювальна логіка — наступний етап',unresolved:'Не розпізнано'},
  fr:{training:'Training',experiment:'Experiment',experimentSoon:'Le squelette Experiment est prêt ; la logique de mesure est la prochaine étape',unresolved:'Non résolu'}
};

export function modeText(lang,key){return MODE_TEXT[lang]?.[key]??MODE_TEXT.en[key]??key;}
