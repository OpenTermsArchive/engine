export function removeIrrelevantModules(document) {
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
        let moduleName = element.querySelector('#moduleName');
        if (moduleName) {
            moduleName = moduleName.textContent;
        }
        if (moduleName && toDelete.includes(moduleName)) {
            element.remove();
        }
    });
}

export function removeNavigationHeaders(document) {
    document.querySelectorAll('#navigationHeader').forEach(element => element.remove());
}

export function removeModuleIDs(document) {
    document.querySelectorAll('#moduleName').forEach(element => element.remove());
}

export function cleanSecondaryTos(document) {
    const divs = document.querySelectorAll('div[class="divModuleDescription"]');
    divs.forEach(element => {
        var name = element.querySelector('span[class="FileName"]');
        if(name){name = name.textContent;}
        if(name.substr(0,2)=="14" && name.substr(0,3)!="14e" && name.substr(0,3)!="14_"){element.remove();}
        if(name=="serviceslist"){element.remove();}
    });

    const navDuplicates = document.querySelectorAll('span[class="navigationHeader"]');
    const moduleDuplicates = document.querySelectorAll('span[class="FileName"]');
    const notuseful = document.querySelectorAll('div[class="displayNone"]');
    navDuplicates.forEach(element => element.remove());
    moduleDuplicates.forEach(element => element.remove());
    notuseful.forEach(element => element.remove());
}

export function removeInvisibleText(document) {
    const notDisplayed = document.querySelectorAll('div[class="displayNone"]');
    const summaries = document.querySelectorAll('div[class="printsummary"]');
    const fulltexts = document.querySelectorAll('div[class="printDetailedContent"]');
    notDisplayed.forEach(element => element.remove());
    summaries.forEach(summary =>  {if (summary.textContent=="Summary") {summary.remove();}});
    fulltexts.forEach(fulltext => {if (fulltext.textContent=="Full text") {fulltext.remove();}});
}
