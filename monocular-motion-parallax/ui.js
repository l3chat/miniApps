export const MODE_TEXT={
  ru:{training:'Training',experiment:'Experiment',unresolved:'Нераспознано',uncertain:'Не уверен',stopExperiment:'■ Стоп Experiment',trial:'Trial',answers:'Ответов',threshold:'Порог 80%',estimating:'оценивается'},
  en:{training:'Training',experiment:'Experiment',unresolved:'Unresolved',uncertain:'Not sure',stopExperiment:'■ Stop Experiment',trial:'Trial',answers:'Answers',threshold:'80% threshold',estimating:'estimating'},
  de:{training:'Training',experiment:'Experiment',unresolved:'Nicht erkannt',uncertain:'Nicht sicher',stopExperiment:'■ Experiment stoppen',trial:'Trial',answers:'Antworten',threshold:'80%-Schwelle',estimating:'wird geschätzt'},
  uk:{training:'Training',experiment:'Experiment',unresolved:'Не розпізнано',uncertain:'Не впевнений',stopExperiment:'■ Зупинити Experiment',trial:'Trial',answers:'Відповідей',threshold:'Поріг 80%',estimating:'оцінюється'},
  fr:{training:'Training',experiment:'Experiment',unresolved:'Non résolu',uncertain:'Pas sûr',stopExperiment:'■ Arrêter Experiment',trial:'Essai',answers:'Réponses',threshold:'Seuil 80 %',estimating:'estimation'}
};

export function modeText(lang,key){return MODE_TEXT[lang]?.[key]??MODE_TEXT.en[key]??key;}
