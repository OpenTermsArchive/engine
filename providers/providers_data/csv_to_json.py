#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Created on Tue Jun 16 11:28:54 2020

@author: adrien
"""

import xmltodict,json
from collections import OrderedDict
import cssify
from os import walk
import csv
#########Functions####################

def treatCSV(fileUsed,dirToExport):
    with open(fileUsed, newline='') as csvfile:
        spamreader = csv.reader(csvfile, delimiter=',')
        for row in spamreader:
            lineToJSON(row,dirToExport)
    
def lineToJSON(line,dirToExport):
    providerName=line[0]
    if providerName=="name":
        return
    tosURL=line[1]
    tosSelector=line[2]
    pcyURL=line[3]
    pcySelector=line[4]
#    dvaURL = dict1['docname']['@name'=='Terms of Service']['url']['@name']
#    dvaSelector = 0
#    dvpURL = dict1['docname']['@name'=='Terms of Service']['url']['@name']
#    dvpSelector = 0
#    dict2=OrderedDict([("serviceProviderName",providerName),
#                       ("documents",OrderedDict([
#                               ("tos",OrderedDict([("url",tosURL),("contentSelector",tosSelector)])),
#                               ("privacy",OrderedDict([("url",pcyURL),("contentSelector",pcySelector)])),
#                               ("devAgreement",OrderedDict([("url",dvaURL),("contentSelector",dvaSelector)])),
#                               ("devPolicy",OrderedDict([("url",dvpURL),("contentSelector",dvpSelector)]))]))])
    dict2=OrderedDict([("serviceProviderName",providerName),
                       ("documents",OrderedDict([
                               ("tos",OrderedDict([("url",tosURL),("contentSelector",tosSelector)])),
                               ("privacy",OrderedDict([("url",pcyURL),("contentSelector",pcySelector)]))]))])
    
    with open(dirToExport+"/"+providerName+".json", 'w') as out_file:
        json.dump(dict2, out_file,indent=4)

################Main###################

csvFile = "providers.csv"
dirToExport="output"
treatCSV(csvFile,dirToExport)
    
