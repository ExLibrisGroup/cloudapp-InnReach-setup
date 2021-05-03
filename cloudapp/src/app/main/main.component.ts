import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Component, OnInit } from '@angular/core';
import {
  CloudAppRestService, CloudAppEventsService, AlertService
} from '@exlibris/exl-cloudapp-angular-lib';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  private logString: string = "";

  private integrationProfileId: string;

  private allLocationCodes: string[] = [];
  private locationsJsonArr = [];

  constructor(private restService: CloudAppRestService,
    private eventsService: CloudAppEventsService,
    private http: HttpClient,
    private alert: AlertService ) { }

  ngOnInit() {
    this.loadLocationCodes();
    this.loadIntegrationProfileId();

    //"icon": {      "type": "font",      "value": "fa fa-paper-plane"   },
  }

  loadLocationCodes() {
    this.restService.call('/conf/libraries').subscribe(result => {
      //console.log(result);
      if (result.library.length < 1) {
        this.logString += "Error: No libraries detected!\n";
      }
      result.library.forEach((elementLib, index) => {
        var libCode = elementLib.code;
        this.restService.call('/conf/libraries/' + libCode + '/locations').subscribe(result => {
            //console.log(result);
            if (result.location) {
              this.logString += "...found " + result.location.length + " locations in library: " + libCode + "\n";
              result.location.forEach((elementHol, index) => {
                var locCode = elementHol.code; var holname = elementHol.name;
                //console.log(libCode +" > " + holCode);
                if (this.allLocationCodes.includes(locCode)) {
                  this.logString += "Warning: Duplicate location code: " + locCode + " skipping code in library: " + libCode + "\n";
                } else {
                  this.allLocationCodes.push(locCode);
                  this.locationsJsonArr.push( {"locationKey":locCode, "description":holname } );
                }

              });
            }
          }
        );
      });
    });
  }

  loadIntegrationProfileId() {
    this.restService.call('/conf/integration-profiles?q=name~innreach&ILL_INTEGRATION=ILL_INTEGRATION').subscribe(result => 
      {
        //console.log(result);
        if (result.integration_profile.length < 1) {
          this.logString += "Error: No ILL_INTEGRATION integration profile with innreach in its name detected!\n";
        }
        if (result.integration_profile.length > 1) {
          this.logString += "Warning: More than one ILL_INTEGRATION integration profile detected - using the first one, which has code: " +
            result.integration_profile[0].code + "\n";
        }

        this.integrationProfileId = result.integration_profile[0].id;
        this.logString += "integration-profile ID: " + this.integrationProfileId + "\n";
      }
    );
  }

  
  callInnreach() {
    this.logString += "Unique locations codes: " + this.allLocationCodes + "\n";

    let locationsJson = { "locationList": this.locationsJsonArr };
    // QA: let locationsJson={"locationList":[{"locationKey":"amlc1", "description":"Alma North Branch"},{"locationKey":"amlc2", "description":"Alma South Branch"}]}

    this.eventsService.getInitData().subscribe(
      data => {
        let url = data.urls['alma'] + "/view/innreachCloudApp";
        console.log("getInitData (to get Alma's URL)...", url);

        this.logString += "User: " + data.user.primaryId + "\n";
        //console.log("App loading Alma's JWT...");
        this.eventsService.getAuthToken().subscribe(
          async jwt => {
            this.logString += "Fetched token from Alma\nCalling https://rssandbox-api.iii.com/innreach/v2/contribution/locations ...\n";
            let authHeader = "Bearer "+ jwt;
            const headers = new HttpHeaders({'Authorization': authHeader, 'X-integrationProfileId': this.integrationProfileId});

            await this.http.post<any>(url, locationsJson, { headers }) //.pipe(timeout(60*1000))
            .toPromise().then(
              response => {
                console.log("rr");
                console.log(response);
                this.logString += "Response: " + JSON.stringify(response) + "\n";
              }, error => {
                console.log("er");
                console.log(error);
                this.logString += "Response: " + JSON.stringify(error.error) + "\n";
              }
            ).catch(e => {
              console.log("ee");
              console.log(e);
              this.logString += "Response: "+ e + "\n";
            });
          }
        )
      }
    );
  }
}
