export function removeIrrelevantModulesPrivacyPolicy(document) {
    const moduleDescriptions = document.querySelectorAll('.divModuleDescription');
    const toDelete = [
        "mainenterprisedeveloperproductsmodule",
        "mainenterpriseservicesmodule",
        "mainenterprisedevsoftwareappsmodule",
        "mainteamsmodule",
        "mainofficeservicesmodule",
        "mainonedrivemodule",
        "mainoutlookmodule",
        "mainlinkedinmodule",
        "mainsearchaimodule",
        "mainbingmodule",
        "maincortanamodule",
        "mainmsedgemodule",
        "mainmsedgemodule",
        "mainMicrosoftTranslatormodule",
        "mainswiftkeymodule",
        "mainwindowsmodule",
        "mainactivationmodule",
        "mainactivityhistorymodule",
        "mainadvertisingidmodule",
        "maindiagnosticsmodule",
        "mainfeedbackhubmodule",
        "mainlocationservicesmotionsensingmodule",
        "mainsecurityandsafetyfeaturesmodule",
        "mainspeechinkingtypingmodule",
        "mainsyncsettingsmodule",
        "mainupdateservicesmodule",
        "mainwebbrowsersmodule",
        "mainwindowsappsmodule",
        "mainwindowsmediaplayermodule",
        "mainwindowshellomodule",
        "mainwindowssearchmodule",
        "mainyourphonemodule",
        "mainentertainmentmodule",
        "mainxboxmodule",
        "mainwindowsstoremodule",
        "mainmainmodule",
        "mainmixermodule",
        "maingroovemusicmoviestvmodule",
        "mainsilverlightmodule",
        "mainwindowsmixedrealitymodule"
    ];
    moduleDescriptions.forEach(moduleDescription => {
        let moduleName = moduleDescription.querySelector('#moduleName');
        if (moduleName) {
            moduleName = moduleName.textContent;
        }
        if (moduleName && toDelete.includes(moduleName)) {
            moduleDescription.remove();
        }
    });
}

export function removeIrrelevantModulesParentTos(document) {
    const moduleDescriptions = document.querySelectorAll('.divModuleDescription');
    moduleDescriptions.forEach(moduleDescription => {
        var name = moduleDescription.querySelector('.FileName');
        if (name) {
            name = name.textContent;
        }
        if (name.substr(0,2)=="14" && name.substr(0,3)!="14e" && name.substr(0,3)!="14_") {
            moduleDescription.remove();
        }
        if (name=="serviceslist") {
            moduleDescription.remove();
        }
    });
}

export function removeNavigationHeaders(document) {
    document.querySelectorAll('#navigationHeader, .navigationHeader').forEach(element => element.remove());
}

export function removeModuleIDs(document) {
    document.querySelectorAll('#moduleName, .FileName').forEach(element => element.remove());
}

export function removeInvisibleText(document) {
    const notDisplayed = document.querySelectorAll('.displayNone');
    const summaries = document.querySelectorAll('.printsummary');
    const fulltexts = document.querySelectorAll('.printDetailedContent');
    notDisplayed.forEach(element => element.remove());
    summaries.forEach(summary =>  {
        if (summary.textContent=="Summary") {
            summary.remove();
        }
    });
    fulltexts.forEach(fulltext => {
        if (fulltext.textContent=="Full text") {
            fulltext.remove();
        }
    });
}
