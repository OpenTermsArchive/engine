
export function cleanPP(document) {
    const divs = document.querySelectorAll('div[class="divModuleDescription"]');
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
    divs.forEach(element => {
        var name = element.querySelector('span[id="moduleName"]');
        if(name){name = name.textContent;}
        if(name && toDelete.includes(name)){element.remove();}
    });
    const navDoublons = document.querySelectorAll('span[id="navigationHeader"]');
    const moduleDoublons = document.querySelectorAll('span[id="moduleName"]');
    const notuseful = document.querySelectorAll('div[class="displayNone"]');
    navDoublons.forEach(element => element.remove());
    moduleDoublons.forEach(element =>element.remove());
    notuseful.forEach(element => element.remove());
}

export function cleanSecondaryTos(document) {
    const divs = document.querySelectorAll('div[class="divModuleDescription"]');
    divs.forEach(element => {
        var name = element.querySelector('span[class="FileName"]');
        if(name){name = name.textContent;}
        if(name.substr(0,2)=="14" && name.substr(0,3)!="14e" && name.substr(0,3)!="14_"){element.remove();}
        if(name=="serviceslist"){element.remove();}
    });

    const navDoublons = document.querySelectorAll('span[class="navigationHeader"]');
    const moduleDoublons = document.querySelectorAll('span[class="FileName"]');
    const notuseful = document.querySelectorAll('div[class="displayNone"]');
    navDoublons.forEach(element => element.remove());
    moduleDoublons.forEach(element => element.remove());
    notuseful.forEach(element => element.remove());
}

export function removeInvisibleText(document) {
    const summaries = document.querySelectorAll('div[class="printsummary"]');
    const fulltexts = document.querySelectorAll('div[class="printDetailedContent"]');
    summaries.forEach(summary =>  {if (summary.textContent=="Summary") {summary.remove();}});
    fulltexts.forEach(fulltext => {if (fulltext.textContent=="Full text") {fulltext.remove();}});
}
