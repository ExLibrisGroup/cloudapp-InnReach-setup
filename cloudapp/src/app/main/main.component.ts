import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Component, OnInit } from '@angular/core';
import {
  CloudAppRestService, CloudAppEventsService, AlertService
} from '@exlibris/exl-cloudapp-angular-lib';
import { map, concatMap, tap } from 'rxjs/operators';
import { forkJoin } from "rxjs";

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  logString: string = "";
  isLoading: boolean = false;
  allowRun: boolean = false;

  private integrationProfileId: string;
  private customerParamHashLocations: string; // hash_innreach_locations_on_publishing

  private allLocationCodes: string[] = [];
  private locationsJsonArr = [];

  constructor(private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService,
    private http: HttpClient,
    private alert: AlertService) { }

  ngOnInit() {
    this.getCustomerParam();
    this.loadIntegrationProfileId();
    //"icon": {      "type": "font",      "value": "fa fa-paper-plane"   },
  }

  getCustomerParam() {
    forkJoin({ initData: this.eventsService.getInitData(), authToken: this.eventsService.getAuthToken() }).pipe(concatMap((data) => {
      let url = data.initData.urls['alma'] + "view/innreachCloudApp?op=getCP";
      let authHeader = "Bearer " + data.authToken;
      //console.log("authHeader:", authHeader);
      const headers = new HttpHeaders({ 'Authorization': authHeader });
      return this.http.get<any>(url, { headers })
    })).subscribe({
      next: response => {
        console.log("rr");
        console.log(response);
        this.logString += "hash_innreach_locations_on_publishing: " + response.hash_innreach_locations_on_publishing + "\n";
        this.customerParamHashLocations = response.hash_innreach_locations_on_publishing;
        console.log(this.customerParamHashLocations);
        this.loadLocationCodes();
       }, error: error => {
        console.log("er");
        console.log(error);
        this.logString += "Response: " + JSON.stringify(error.error) + "\n";
        this.alert.error(`Operation failed. Cause: ${error.message}`)
      }
    });
  }

  loadLocationCodes() {

    this.restService.call('/conf/libraries').subscribe(result => {
      //console.log(result);
      if (!result.library) {
        this.logString += "Error: No libraries detected!\n";
        return;
      }
      result.library.forEach((elementLib, index) => {
        var libCode = elementLib.code;
        var libName = elementLib.name;
        this.restService.call('/conf/libraries/' + libCode + '/locations').subscribe(result => {
          //console.log(result);
          if (result.location) {
            this.logString += "...found " + result.location.length + " locations in library: " + libCode + "\n";
            result.location.forEach((elementHol, index) => {
              var locCode = elementHol.code; var holname = elementHol.name;
              //console.log(libCode +" > " + holCode);
              if (this.customerParamHashLocations == "true") {
                this.locationsJsonArr.push({ "locationKey": libCode+"."+locCode, "description": libName+" - "+holname });
              } else {
                if (locCode.length > 5) {
                  this.logString += "Warning: location code longer than 5 characters: " + locCode + " in library: " + libCode + "\n";
                } else if (this.allLocationCodes.includes(locCode)) {
                  this.logString += "Warning: Duplicate location code: " + locCode + ". Skipping the one in library: " + libCode + "\n";
                } else {
                  this.allLocationCodes.push(locCode);
                  this.locationsJsonArr.push({ "locationKey": locCode, "description": holname });
                }
              }
            });
          }
        });
      });
    });
  }

  loadIntegrationProfileId() {
    this.restService.call('/conf/integration-profiles?q=name~innreach&type=ILL_INTEGRATION').subscribe(result => {
      console.log("loadIntegrationProfileId(): ", result);
      if (!result.integration_profile) {
        this.logString += "Error: No ILL_INTEGRATION integration profile with innreach in its name detected!\n";
        this.alert.error("No Integration profile ID as been found");
        return;
      }
      if (result.integration_profile.length > 1) {
        this.logString += "Warning: More than one ILL_INTEGRATION integration profile detected - using the first one, which has code: " +
          result.integration_profile[0].code + "\n";
      }

      this.integrationProfileId = result.integration_profile[0].id;
      this.logString += "integration-profile ID: " + this.integrationProfileId + "\n";

      this.allowRun = !this.allowRun;

    });
  }

  callInnreach(e) {
    console.log(e)
    this.isLoading = true;
    //this.logString += "Unique location codes: " + this.allLocationCodes + "\n";
    let locationsJson = this.locationsJsonArr;
    // tests: 
    // let locationsJson=[{"locationKey":"amlc1", "description":"Alma North Branch"},{"locationKey":"amlc2", "description":"Alma South Branch"}]

    forkJoin({ initData: this.eventsService.getInitData(), authToken: this.eventsService.getAuthToken() }).pipe(concatMap((data) => {
      let url = data.initData.urls['alma'] + "view/innreachCloudApp";
      console.log("getInitData (to get Alma's URL): ", url);
      this.logString += "User: " + data.initData.user.primaryId + "\n";
      this.logString += "Fetched token from Alma\nCalling https://innreach-url/innreach/v2/contribution/locations ...\n";
      this.logString += "Body:\n" + JSON.stringify(locationsJson) + "\n";
      let authHeader = "Bearer " + data.authToken;
      console.log("authHeader:", authHeader);
      const headers = new HttpHeaders({ 'Authorization': authHeader, 'X-integrationProfileId': this.integrationProfileId });
      return this.http.post<any>(url, locationsJson, { headers })
    })).subscribe({
      next: response => {
        console.log("rr");
        console.log(response);
        this.logString += "Response: " + JSON.stringify(response) + "\n";
        this.alert.success("Done");
        this.isLoading = false;
      }, error: error => {
        console.log("er");
        console.log(error);
        this.logString += "Response: " + JSON.stringify(error.error) + "\n";
        this.alert.success("Done");
        this.isLoading = false;
      }
    });
  }








}
