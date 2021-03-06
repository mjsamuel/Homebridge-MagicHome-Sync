import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import axios, { AxiosResponse } from "axios";

let hap: HAP;

export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("MagicHomeSync", MagicHomeSync);
};

class MagicHomeSync implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;

  private readonly apiUrl: string;
  private readonly lightIp: string;
  private readonly lightType: string;
  private readonly pollingInterval: number;

  private readonly switchService: Service;
  private readonly informationService: Service;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    this.apiUrl = "http://" + config.host_ip + ":" + config.host_port + "/api/state"
    this.lightIp = config.light_ip
    this.lightType = config.light_type
    this.pollingInterval = config.polling_interval

    this.switchService = new hap.Service.Switch(this.name);

    this.switchService
      .getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        axios.get(this.apiUrl)
          .then((response) => {
            let status = response.data["status"]
            log.info("Got host state as: " + status);
            callback(undefined, status === "enabled");
          })
          .catch(error => {
            log.info("Failed to get host state: Error communicating with host")
            callback(error);
          });
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        let status = value as boolean;
        axios.post(this.apiUrl, {
          "status": status,
          "light_ip": this.lightIp,
          "light_type": this.lightType,
          "polling_interval": this.pollingInterval
        })
        .then((response) => {
          let status = response.data["status"]
          log.info("Host state has been set to: " + (status ? "enabled" : "disabled"));
          callback(undefined, status === "enabled");
        })
        .catch(error => {
          if (error.response !== undefined  && error.response.status === 400) {
            log.info("Failed to update host state: " + error.response.data["error"])
          } else {
            log.info("Failed to update host state: Error communicating with host")
          }
          callback(error);
        });
      });

    this.informationService = new hap.Service.AccessoryInformation()

    log.info("Finished initializing");
  }

  getServices(): Service[] {
    return [
      this.informationService,
      this.switchService,
    ];
  }
}

