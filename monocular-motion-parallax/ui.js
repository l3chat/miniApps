export const MODE_TEXT={
  ru:{training:'Training',experiment:'Experiment',unresolved:'Нераспознано',uncertain:'Не уверен',stopExperiment:'■ Стоп Experiment',trial:'Trial',answers:'Ответов',threshold:'Порог 80%',estimating:'оценивается',autofocusNearest:'Автофокус на ближайший объект',screenDistance:'Расстояние до сетки'},
  en:{training:'Training',experiment:'Experiment',unresolved:'Unresolved',uncertain:'Not sure',stopExperiment:'■ Stop Experiment',trial:'Trial',answers:'Answers',threshold:'80% threshold',estimating:'estimating',autofocusNearest:'Autofocus nearest object',screenDistance:'Grid distance'},
  de:{training:'Training',experiment:'Experiment',unresolved:'Nicht erkannt',uncertain:'Nicht sicher',stopExperiment:'■ Experiment stoppen',trial:'Trial',answers:'Antworten',threshold:'80%-Schwelle',estimating:'wird geschätzt',autofocusNearest:'Autofokus auf nächstes Objekt',screenDistance:'Abstand zum Gitter'},
  uk:{training:'Training',experiment:'Experiment',unresolved:'Не розпізнано',uncertain:'Не впевнений',stopExperiment:'■ Зупинити Experiment',trial:'Trial',answers:'Відповідей',threshold:'Поріг 80%',estimating:'оцінюється',autofocusNearest:'Автофокус на найближчий об’єкт',screenDistance:'Відстань до сітки'},
  fr:{training:'Training',experiment:'Experiment',unresolved:'Non résolu',uncertain:'Pas sûr',stopExperiment:'■ Arrêter Experiment',trial:'Essai',answers:'Réponses',threshold:'Seuil 80 %',estimating:'estimation',autofocusNearest:'Mise au point sur l’objet le plus proche',screenDistance:'Distance de la grille'}
};

export function modeText(lang,key){return MODE_TEXT[lang]?.[key]??MODE_TEXT.en[key]??key;}
