export function removeIrrelevantModulesFromPrivacyPolicy(document) {
  const OTHER_SERVICES_POLICIES = [
    'mainenterprisedeveloperproductsmodule',
    'mainenterpriseservicesmodule',
    'mainenterprisedevsoftwareappsmodule',
    'mainteamsmodule',
    'mainofficeservicesmodule',
    'mainonedrivemodule',
    'mainoutlookmodule',
    'mainlinkedinmodule',
    'mainsearchaimodule',
    'maincortanamodule',
    'mainmsedgemodule',
    'mainmsedgemodule',
    'mainMicrosoftTranslatormodule',
    'mainswiftkeymodule',
    'mainwindowsmodule',
    'mainactivationmodule',
    'mainactivityhistorymodule',
    'mainadvertisingidmodule',
    'maindiagnosticsmodule',
    'mainfeedbackhubmodule',
    'mainlocationservicesmotionsensingmodule',
    'mainsecurityandsafetyfeaturesmodule',
    'mainspeechinkingtypingmodule',
    'mainsyncsettingsmodule',
    'mainupdateservicesmodule',
    'mainwebbrowsersmodule',
    'mainwindowsappsmodule',
    'mainwindowsmediaplayermodule',
    'mainwindowshellomodule',
    'mainwindowssearchmodule',
    'mainyourphonemodule',
    'mainentertainmentmodule',
    'mainxboxmodule',
    'mainwindowsstoremodule',
    'mainmainmodule',
    'mainmixermodule',
    'maingroovemusicmoviestvmodule',
    'mainsilverlightmodule',
    'mainwindowsmixedrealitymodule',
    'mainskypemodule',
  ];

  document.querySelectorAll('.divModuleDescription').forEach(moduleDescription => {
    let moduleName = moduleDescription.querySelector('#moduleName');

    if (moduleName) {
      moduleName = moduleName.textContent;
    }
    if (moduleName && OTHER_SERVICES_POLICIES.includes(moduleName)) {
      moduleDescription.remove();
    }
  });
}

export function removeIrrelevantModulesFromTos(document) {
  const OTHER_SERVICES_TOS = /^14[^e_]/; // match all section 14 entities except "Terms14_service-SpecificTerms" and "14e_Skype"

  document.querySelectorAll('.divModuleDescription').forEach(moduleDescription => {
    let moduleName = moduleDescription.querySelector('.FileName');

    if (moduleName) {
      moduleName = moduleName.textContent;
    }
    if (moduleName.match(OTHER_SERVICES_TOS) || moduleName === 'serviceslist') {
      moduleDescription.remove();
    }
  });
}

export function removeNavigationHeaders(document) {
  document
    .querySelectorAll('#navigationHeader, .navigationHeader')
    .forEach(element => element.remove());
}

export function removeModuleIDs(document) {
  document.querySelectorAll('#moduleName, .FileName').forEach(element => element.remove());
}

export function removeInvisibleText(document) {
  document.querySelectorAll('.displayNone').forEach(element => element.remove());
  document.querySelectorAll('.printsummary').forEach(element => element.remove());
  document.querySelectorAll('.printDetailedContent').forEach(element => element.remove());
}
