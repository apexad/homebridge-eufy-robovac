# homebridge-eufy-robovac
Homebridge plugin for Eufy RoboVac

### Features

* Switch on / off. When off, it will returning to charging dock automatically.

* Display battery level, and notify on low battery.

* Display battery charging state.

* Find robot

### Configuration
This easiest way to use this plugin is to use [homebridge-config-ui-x](https://www.npmjs.com/package/homebridge-config-ui-x).  
To configure manually, add to the `accessories` section of homebridge's `config.json` after installing the plugin.

**Command:** ```npm install -g homebridge-eufy-robovac```

**Config:**
  ```json
    {
      "accessory": "Eufy RoboVac",
      "name": "Vacuum Cleaner",
      "ip": "<IP address of your vacuum cleaner>",
      "deviceId": "<deviceId/devId>",
      "localKey": "<localKey>",
      "hideFindButton": "<true | false, defaults to false>",
      "hideErrorSensor": "<true | false, defaults to false>",
      "useSwitchService": "<true | false, defaults to false>",
      "debugLog": "<true | false, defaults to false>"
    }
  ``` 
You can find out more about the `deviceId`/`localKey` [here](https://github.com/joshstrange/eufy-robovac)

Eufy RoboVac will be added to Home app a fan accessory (since HomeKit does not natively support vacuums).  
If `hideFindButton` is not supplied or set to false, a switch that performs the 'Find' function will also be added.  
If `hideErrorSensor` is not supplied or set to false, a Motion Sensor that is active when the vacuum has an error will also be added.  
If `useSwitchService` is true, main Vacuum will be a switch instead of fan.  
if `debugLog` is enabled (set to true), the underlying library will outut many logs.

### Get Device ID & Local Key

To get the `deviceId`/`localKey` use the [`eufy-clean-local-key-grabber`](https://github.com/Rjevski/eufy-clean-local-key-grabber/tree/master) repository.

In a somewhat recent Python 3 environment (Python 3.9 was used for development), execute the following commands:

```bash
pip install -r requirements.txt
python -m eufy_local_id_grabber "<EUFY ACCOUNT EMAIL>" "<EUFY ACCOUNT PASSWORD>"
```

You will receive the following output:

```
Home: <home ID>
Device: RoboVac, device ID <device ID>, local key <local key>
```

This will list all the devices in all the "homes" on your account. Note that it's unclear whether you can have more than one "home" in Eufy.

### Thank You

* [mitchellrj](https://github.com/mitchellrj) - Did most of the legwork in figuring out how to talk to the Eufy
* [seikan](https://github.com/seikan) - Provided a [great example](https://github.com/seikan/homebridge-xiaomi-mi-robot-vacuum) for how to expose a vacuum cleaner in homebridge/homekit


## Development

This plugin is written in TypeScript. You should just need to run `npm run build` after making changes in the `src/` directory.

Also this plugin is dependent on [eufy-robovac](https://github.com/joshstrange/eufy-robovac/) so you will probably want to fork that repo as well.
