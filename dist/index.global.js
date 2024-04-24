// Name: WebRTC
// ID: webrtc
// Description: Barebones WebRTC implementation for Scratch.
// By: MikeDEV
// License: MIT

(() => {
  // src/index.ts
  (function(Scratch2) {
    if (!Scratch2.extensions.unsandboxed) {
      throw new Error("Sandboxed mode is not supported in this extension.");
    }
    class PeerConnection extends RTCPeerConnection {
      name;
      constructor(configuration) {
        super(configuration);
      }
    }
    function until(conditionFunction) {
      const poll = (resolve) => {
        if (conditionFunction())
          resolve();
        else
          setTimeout(() => poll(resolve), 100);
      };
      return new Promise(poll);
    }
    class OmegaRTC {
      // Properties and types for data connections
      dataConnections;
      dataChannels;
      dataStorage;
      dataIceCandidates;
      dataIceDone;
      // Properties and types for voice connections
      voiceConnections;
      voiceStreams;
      voiceIceCandidates;
      voiceIceDone;
      // Type for configuration
      configuration;
      // Type for event handlers
      eventHandlers;
      // Constructor for OmegaRTC
      constructor() {
        this.dataConnections = /* @__PURE__ */ new Map();
        this.dataChannels = /* @__PURE__ */ new Map();
        this.dataStorage = /* @__PURE__ */ new Map();
        this.dataIceCandidates = /* @__PURE__ */ new Map();
        this.dataIceDone = /* @__PURE__ */ new Map();
        this.voiceConnections = /* @__PURE__ */ new Map();
        this.voiceStreams = /* @__PURE__ */ new Map();
        this.voiceIceCandidates = /* @__PURE__ */ new Map();
        this.voiceIceDone = /* @__PURE__ */ new Map();
        this.eventHandlers = /* @__PURE__ */ new Map();
        this.configuration = {
          iceServers: [
            { urls: "stun:vpn.mikedev101.cc:3478" },
            {
              urls: "turn:vpn.mikedev101.cc:3478",
              username: "free",
              credential: "free"
            },
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:freeturn.net:3478" },
            { urls: "stun:freeturn.net:5349" },
            {
              urls: "turn:freeturn.net:3478",
              username: "free",
              credential: "free"
            },
            {
              urls: "turns:freeturn.net:5349",
              username: "free",
              credential: "free"
            }
          ],
          iceTransportPolicy: "all",
          supportsTrickleIce: false
        };
      }
      /**
       * Gets an array of all peers from dataConnections.
       *
       * @return {Array<string>} The list of peers.
       */
      getPeers() {
        const output = [];
        for (const id of this.dataConnections.keys())
          output.push(id);
        return output;
      }
      /**
       * Gets an array of connected peers from dataConnections.
       *
       * @return {Array<string>} The list of connected peers.
       */
      getConnectedPeers() {
        const output = [];
        for (const id of this.dataConnections.keys()) {
          if (this.dataConnections.get(id).connectionState == "connected")
            output.push(id);
        }
        return output;
      }
      doneGatheringIce(id) {
        if (!this.dataConnections.has(id))
          return false;
        return this.dataIceDone.get(id);
      }
      allIceCandidates(id) {
        if (!this.dataConnections.has(id))
          return [];
        if (!this.dataIceDone.get(id))
          return [];
        return this.dataIceCandidates.get(id);
      }
      /**
       * Sets the ICE transport policy to relay only if mode is true, otherwise set it to all.
       *
       * @param {boolean} mode - true to set ICE transport policy to relay, false to set it to all
       */
      relayOnly(mode) {
        this.configuration.iceTransportPolicy = mode ? "relay" : "all";
      }
      /**
       * Programs the class to support trickle ICE if mode is true, otherwise all ICE candidates
       * will be provided once gathering is complete.
       *
       * @param {boolean} mode - true to enable trickle ICE support, false to disable
       */
      supportsTrickeIce(mode) {
        this.configuration.supportsTrickleIce = mode;
      }
      /**
       * Registers a callback function to be executed when a specific event is triggered.
       *
       * @param {string} eventName - The name of the event to listen for.
       *
       * Examples:
       * {id}_ice - When an ICE candidate has been acquired
       * {id}_ice-done - When a connection has finished gathering ICE candidates
       * {id}_open - When a connection has been established
       * {id}_closed - When a connection has been disconnected
       * {id}_message - When a message has been received from a data channel
       * {id}_channel-open - When a data channel has been established
       * {id}_channel-close - When a data channel has been disconnected
       *
       * @param {(...args: any[]) => void} callback - The function to be executed when the event is triggered.
       */
      on(eventName, callback) {
        if (!this.eventHandlers.has(eventName)) {
          this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(callback);
      }
      /**
       * A function that triggers a specified event with optional arguments.
       *
       * @param {string} eventName - the name of the event to trigger
       * @param {...any} args - optional arguments to pass to the event handlers
       */
      fire(eventName, ...args) {
        if (!this.eventHandlers.has(eventName)) {
          return;
        }
        this.eventHandlers.get(eventName).forEach((callback) => {
          callback(...args);
        });
      }
      /**
       * Creates an offer for the given id, name and mode.
       *
       * @param {string} id - The id of the connection.
       * @param {string} name - The user-friendly name of the connection.
       * @param {number} mode - The mode to create the connection in. 0 for data, 1 for voice.
       * @param {boolean} setup - Optional: If the connection is used for voice, set to true if we want to transmit audio. Otherwise, only accept incoming audio.
       * @return {RTCSessionDescriptionInit | void} The created offer or void if an error occurs.
       */
      async createOffer(id, name, mode, setup) {
        try {
          const conn = await this.getConnectionObject(
            id,
            mode,
            setup
          );
          conn.name = name;
          const offer = await conn.createOffer();
          await conn.setLocalDescription(offer);
          return offer;
        } catch (error) {
          console.error(`Failed to create offer: ${error.message}`);
        }
      }
      /**
       * Create an answer for the given id, name, mode and offer.
       *
       * @param {string} id - The id of the connection.
       * @param {string} name - The user-friendly name of the connection.
       * @param {number} mode - The mode to create the connection in. 0 for data, 1 for voice.
       * @param {RTCSessionDescriptionInit} offer - The incoming offer for the connection.
       * @param {boolean} setup - Optional: If the connection is used for voice, set to true if we want to transmit audio. Otherwise, only accept incoming audio.
       * @return {Promise<RTCSessionDescriptionInit | void>} The created answer or void if an error occurs.
       */
      async createAnswer(id, name, mode, offer, setup) {
        try {
          const conn = await this.getConnectionObject(
            id,
            mode,
            setup
          );
          conn.name = name;
          await conn.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await conn.createAnswer();
          await conn.setLocalDescription(answer);
          return answer;
        } catch (error) {
          console.error(`Failed to create answer: ${error.message}`);
        }
      }
      /**
       * Handles an answer for the given id, mode and answer.
       *
       * @param {string} id - The id of the connection.
       * @param {number} mode - The mode to handle the connection in. 0 for data, 1 for voice.
       * @param {RTCSessionDescriptionInit} answer - The incoming answer for the connection.
       */
      async handleAnswer(id, mode, answer) {
        try {
          const conn = await this.getConnectionObject(
            id,
            mode
          );
          await conn.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
          console.error(`Failed to handle answer: ${error.message}`);
        }
      }
      /**
       * Handles an ICE candidate for the given id, mode and candidate.
       *
       * @param {string} id - The id of the connection.
       * @param {number} mode - The mode to handle the connection in. 0 for data, 1 for voice.
       * @param {RTCIceCandidate} candidate - The incoming ICE candidate for the connection.
       */
      async handleIceCandidate(id, mode, candidate) {
        try {
          const conn = await this.getConnectionObject(
            id,
            mode
          );
          await conn.addIceCandidate(candidate);
        } catch (error) {
          console.error(`Failed to handle ICE candidate: ${error.message}`);
        }
      }
      /**
       * Creates or returns a connection based on the given id and mode.
       *
       * @param {string} id - The id for the connection.
       * @param {number} mode - The mode indicating the type of connection to create. 0 for data, 1 for voice.
       * @return {PeerConnection} The created or returned PeerConnection or an error if mode is invalid.
       */
      async getConnectionObject(id, mode, setup) {
        switch (mode) {
          case 0:
            return this.getDataConnection(id);
          case 1:
            if (typeof setup === "undefined")
              throw new Error("Missing setup parameter for voice connection.");
            return await this.getVoiceConnection(id, setup);
          default:
            throw new Error(
              `Invalid connection mode. Expected 0 (data) or 1 (voice), got ${mode} instead.`
            );
        }
      }
      /**
       * Get an array of all data channels for a peer with a given ID.
       *
       * @param {string} id - The ID of the data channels.
       * @return {Array<string>} An array of peer channels.
       */
      getPeerChannels(id) {
        if (!this.dataChannels.has(id))
          return [];
        return Array.from(this.dataChannels.get(id).keys());
      }
      /**
       * Returns true if a peer with the given ID exists and is connected.
       *
       * @param {string} id - description of parameter
       * @return {boolean} description of return value
       */
      isPeerConnected(id) {
        if (!this.dataConnections.has(id))
          return false;
        const conn = this.dataConnections.get(id);
        return conn.connectionState === "connected";
      }
      /**
       * Check if a specific label exists for a given channel ID.
       *
       * @param {string} id - The ID of the channel to check.
       * @param {string} label - The label to check for in the channel.
       * @return {boolean} True if the label exists in the channel, false otherwise.
       */
      doesPeerChannelExist(id, label) {
        if (!this.dataChannels.has(id))
          return false;
        return this.dataChannels.get(id).has(label);
      }
      /**
       * Close a specific channel identified by id and label.
       *
       * @param {string} id - The unique identifier of the channel.
       * @param {string} label - The label associated with the channel.
       * @return {void} This function does not return anything.
       */
      closeChannel(id, label) {
        if (!this.dataChannels.has(id))
          return;
        if (!this.dataChannels.get(id).has(label))
          return;
        const chan = this.dataChannels.get(id).get(label);
        chan.close();
        this.dataChannels.get(id).delete(label);
        this.dataStorage.get(id).delete(label);
      }
      /**
       * Creates or returns a data connection based on the provided id.
       *
       * @param {string} id - The unique identifier for the connection.
       * @return {PeerConnection} The created or existing data connection.
       */
      getDataConnection(id) {
        if (this.dataConnections.has(id))
          return this.dataConnections.get(id);
        const conn = new PeerConnection(this.configuration);
        this.dataConnections.set(id, conn);
        this.dataIceCandidates.set(id, []);
        this.dataIceDone.set(id, false);
        this.dataStorage.set(id, /* @__PURE__ */ new Map());
        this.dataChannels.set(id, /* @__PURE__ */ new Map());
        const chan = conn.createDataChannel("default", {
          negotiated: true,
          id: 0,
          ordered: true
        });
        this.handleDataChannel(chan, "default", id);
        conn.onicecandidate = (event) => {
          if (event.candidate)
            this.dataIceCandidates.get(id).push(event.candidate);
          switch (conn.iceGatheringState) {
            case "gathering":
              if (this.configuration.supportsTrickleIce)
                this.fire(`${id}_ice`, event.candidate);
              break;
            case "complete":
              console.log(
                `Finished gathering data ICE candidates for peer ${id}.`
              );
              this.fire(`${id}_ice-done`, event.candidate);
              this.dataIceDone.set(id, true);
              break;
          }
        };
        conn.onconnectionstatechange = () => {
          switch (conn.connectionState) {
            case "new":
              console.log(`Data peer ${id} created.`);
              break;
            case "connecting":
              console.log(`Data peer ${id} connecting...`);
              break;
            case "connected":
              console.log(`Data peer ${id} connected.`);
              this.fire(`${id}_connected`);
              break;
            case "closed":
              console.log(`Data peer ${id} disconnected.`);
              this.closeDataConnection(id);
              this.fire(`${id}_closed`);
              break;
            case "failed":
              console.log(`Data peer ${id} failed.`);
              this.closeDataConnection(id);
              this.fire(`${id}_closed`);
              break;
          }
        };
        conn.ondatachannel = (event) => this.handleDataChannel(event.channel, event.channel.label, id);
        return conn;
      }
      /**
       * Store the RTCDataChannel object in the data channels map, and binds
       * event handlers to process incoming data.
       *
       * @param {RTCDataChannel} chan - the RTCDataChannel object to store
       * @param {string} label - the label associated with the RTCDataChannel
       * @param {string} id - the connection id associated with the RTCDataChannel
       */
      handleDataChannel(chan, label, id) {
        chan.onmessage = (event) => {
          this.dataStorage.get(id).set(label, event.data);
          this.fire(`${id}_message`, event.data);
        };
        chan.onopen = () => {
          this.fire(`${id}_channel-open`, label);
          console.log(`Data channel ${label} opened for ${id}.`);
        };
        chan.onclose = () => {
          this.fire(`${id}_channel-close`, label);
          console.log(`Data channel ${label} closed for ${id}.`);
          if (label === "default") {
            this.closeDataConnection(id);
            this.fire(`${id}_closed`);
          }
        };
        this.dataChannels.get(id).set(label, chan);
      }
      /**
       * Returns the most recent data received from a connection.
       *
       * @param {string} id - ID of the connection
       * @param {string} label - channel label to get data from
       * @return {any | void} the most recent data, or void if there is no data
       */
      getChannelData(id, label) {
        if (!this.dataStorage.has(id))
          return;
        if (!this.dataStorage.get(id).has(label))
          return;
        return this.dataStorage.get(id).get(label);
      }
      /**
       * Sends data to a specific connection id, and through a specific data channel label.
       *
       * @param {string} id - The ID of the connection.
       * @param {string} label - The label of the data channel to send the data through.
       * @param {string} data - The data to be sent.
       * @param {boolean} wait - Flag indicating whether to wait for the send operation to complete.
       * @return {Promise<void> | void} If wait is true, returns a Promise that resolves when the send operation completes.
       */
      sendData(id, label, data, wait) {
        if (!this.dataChannels.has(id))
          return;
        if (!this.dataChannels.get(id).has(label))
          return;
        const chan = this.dataChannels.get(id).get(label);
        if (wait)
          chan.bufferedAmountLowThreshold = 0;
        chan.send(data);
        if (wait)
          return new Promise((resolve) => {
            chan.onbufferedamountlow = () => resolve();
          });
      }
      /**
       * A function to prepare the a connection by adding audio tracks from the user's media devices.
       *
       * @param {PeerConnection} conn - The PeerConnection object to add audio tracks to.
       */
      async setupVoiceConnection(id) {
        const conn = this.voiceConnections.get(id);
        await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          stream.getTracks().forEach((track) => conn.addTrack(track, stream));
          console.log(`Ready for voice stream with ${conn.name}.`);
        }).catch((err) => {
          console.error(`Error preparing audio stream for ${conn.name}: ${err}`);
          this.closeVoiceConnection(id);
        });
      }
      /**
       * Closes a data connection based on the given ID.
       *
       * @param {string} id - The ID of the data connection to close.
       * @return {void}
       */
      closeDataConnection(id) {
        const conn = this.dataConnections.get(id);
        if (this.dataChannels.has(id))
          for (const chan of this.dataChannels.get(id).values())
            chan.close();
        if (conn)
          conn.close();
        this.dataConnections.delete(id);
        this.dataChannels.delete(id);
        this.dataStorage.delete(id);
        this.dataIceCandidates.delete(id);
        this.dataIceDone.delete(id);
      }
      /**
       * Closes a voice connection based on the given ID.
       *
       * @param {string} id - The ID of the connection to close
       * @return {void}
       */
      closeVoiceConnection(id) {
        const conn = this.voiceConnections.get(id);
        conn.getSenders().forEach((sender) => {
          if (sender.track)
            sender.track.stop();
        });
        for (let n = 0; n < this.voiceStreams.get(id).length; n++) {
          const audioElement = document.getElementById(`audio_${n}_${id}`);
          if (audioElement)
            document.body.removeChild(audioElement);
        }
        this.voiceConnections.delete(id);
        this.voiceIceCandidates.delete(id);
        this.voiceStreams.delete(id);
        this.voiceIceDone.delete(id);
      }
      /**
       * Create a new RTCDataChannel for the given id, label, and ordered flag.
       *
       * @param {string} id - The id for the connection.
       * @param {string} label - The label for the data channel.
       * @param {boolean} ordered - Indicates if the data channel is ordered.
       * @return {RTCDataChannel | void} The newly created data channel or void if the connection id is not found.
       */
      createDataChannel(id, label, ordered) {
        if (!this.dataConnections.has(id))
          return;
        const conn = this.dataConnections.get(id);
        return conn.createDataChannel(label, {
          negotiated: false,
          ordered,
          protocol: "clomega"
        });
      }
      /**
       * Creates or returns a voice connection based on the provided id.
       *
       * @param {string} id - The unique identifier of the connection.
       * @param {boolean} setup - If true, ask the user to allow microphone access and add audio tracks to the connection.
       * @return {PeerConnection} The created or existing voice connection.
       */
      async getVoiceConnection(id, setup) {
        if (this.voiceConnections.has(id))
          return this.voiceConnections.get(id);
        const conn = new PeerConnection(this.configuration);
        this.voiceConnections.set(id, conn);
        this.voiceIceCandidates.set(id, []);
        this.voiceIceDone.set(id, false);
        this.voiceStreams.set(id, []);
        conn.onicecandidate = (event) => {
          if (event.candidate)
            this.voiceIceCandidates.get(id).push(event.candidate);
          if (conn.iceGatheringState === "complete")
            this.voiceIceDone.set(id, true);
        };
        conn.onconnectionstatechange = () => {
          switch (conn.connectionState) {
            case "new":
              console.log(`Voice peer ${id} created.`);
              break;
            case "connecting":
              console.log(`Voice peer ${id} connecting...`);
              break;
            case "connected":
              console.log(`Voice peer ${id} connected.`);
              break;
            case "closed":
              console.log(`Voice peer ${id} disconnected.`);
              this.closeVoiceConnection(id);
              break;
            case "failed":
              console.log(`Voice peer ${id} failed.`);
              this.closeVoiceConnection(id);
              break;
          }
        };
        conn.ontrack = (event) => {
          console.log(
            `Adding peer ${id} incoming streams: ${event.streams.length} streams incoming.`
          );
          let n = 0;
          for (const stream of event.streams) {
            this.voiceStreams.get(id).push(stream);
            const options = {
              id: `audio_${n}_${id}`,
              autoplay: true,
              srcObject: stream
            };
            const audioElement = document.createElement(`audio`, options);
            document.body.appendChild(audioElement);
            n++;
          }
        };
        if (setup)
          await this.setupVoiceConnection(id);
        return conn;
      }
    }
    const webrtc = new OmegaRTC();
    class ScratchWebRTC {
      vm;
      offers;
      answers;
      ice;
      iceComplete;
      blockIconURI;
      menuIconURI;
      constructor(vm) {
        this.vm = vm;
        this.offers = /* @__PURE__ */ new Map();
        this.answers = /* @__PURE__ */ new Map();
        this.ice = /* @__PURE__ */ new Map();
        this.iceComplete = /* @__PURE__ */ new Map();
        this.menuIconURI = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIEdlbmVyYXRvcjogU1ZHIFJlcG8gTWl4ZXIgVG9vbHMgLS0+Cjxzdmcgd2lkdGg9IjgwMHB4IiBoZWlnaHQ9IjgwMHB4IiB2aWV3Qm94PSIwIC0zLjUgMjU2IDI1NiIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCI+Cgk8Zz4KCQk8cGF0aCBkPSJNMTQyLjA3NjU3OCwxOTEuMDg2ODE3IEMxNDIuMDc2NTc4LDE1OS4yODA2NTYgMTE2LjI5NDc1OSwxMzMuNDk0NjE1IDg0LjQ4ODU5NjksMTMzLjQ5NDYxNSBDNTIuNjc4MjEzNiwxMzMuNDk0NjE1IDI2Ljg5NjM5NCwxNTkuMjgwNjU2IDI2Ljg5NjM5NCwxOTEuMDg2ODE3IEMyNi44OTYzOTQsMjIyLjg5Mjk3OSA1Mi42NzgyMTM2LDI0OC42NzkwMiA4NC40ODg1OTY5LDI0OC42NzkwMiBDMTE2LjI5NDc1OSwyNDguNjc5MDIgMTQyLjA3NjU3OCwyMjIuODkyOTc5IDE0Mi4wNzY1NzgsMTkxLjA4NjgxNyIgZmlsbD0iI0ZGNjYwMCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoODQuNDg2NDg2LCAxOTEuMDg2ODE3KSBzY2FsZSgxLCAtMSkgdHJhbnNsYXRlKC04NC40ODY0ODYsIC0xOTEuMDg2ODE3KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik0yNTUuOTc5NzAzLDExMC40NTQzNTYgQzI1NS45Nzk3MDMsNzguNjUyNDE2IDIzMC4xOTc4ODQsNTIuODYyMTUzIDE5OC4zOTE3MjIsNTIuODYyMTUzIEMxNjYuNTgxMzM5LDUyLjg2MjE1MyAxNDAuNzk5NTE5LDc4LjY1MjQxNiAxNDAuNzk5NTE5LDExMC40NTQzNTYgQzE0MC43OTk1MTksMTQyLjI2MDUxOCAxNjYuNTgxMzM5LDE2OC4wNTA3ODEgMTk4LjM5MTcyMiwxNjguMDUwNzgxIEMyMzAuMTk3ODg0LDE2OC4wNTA3ODEgMjU1Ljk3OTcwMywxNDIuMjYwNTE4IDI1NS45Nzk3MDMsMTEwLjQ1NDM1NiIgZmlsbD0iI0ZGQ0MwMCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTk4LjM4OTYxMSwgMTEwLjQ1NjQ2Nykgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtMTk4LjM4OTYxMSwgLTExMC40NTY0NjcpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTExNS4yMDA0OTgsMTA5LjE3NjQ1MiBDMTE1LjIwMDQ5OCw3Ny4zNzQ1MTI1IDg5LjQxODY3ODYsNTEuNTg0MjQ5NSA1Ny42MDgyOTUzLDUxLjU4NDI0OTUgQzI1LjgwNjM1NTMsNTEuNTg0MjQ5NSAwLjAyMDMxNDAyNzEsNzcuMzc0NTEyNSAwLjAyMDMxNDAyNzEsMTA5LjE3NjQ1MiBDMC4wMjAzMTQwMjcxLDE0MC45ODI2MTQgMjUuODA2MzU1MywxNjYuNzcyODc3IDU3LjYwODI5NTMsMTY2Ljc3Mjg3NyBDODkuNDE4Njc4NiwxNjYuNzcyODc3IDExNS4yMDA0OTgsMTQwLjk4MjYxNCAxMTUuMjAwNDk4LDEwOS4xNzY0NTIiIGZpbGw9IiMwMDg5Q0MiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU3LjYxMDQwNiwgMTA5LjE3ODU2Mykgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtNTcuNjEwNDA2LCAtMTA5LjE3ODU2MykgIj4KDTwvcGF0aD4KCQk8cGF0aCBkPSJNMjMwLjM4NTc0OSwxOTEuMDg2ODE3IEMyMzAuMzg1NzQ5LDE1OS4yODA2NTYgMjA0LjYwMzkyOSwxMzMuNDk0NjE1IDE3Mi43ODkzMjQsMTMzLjQ5NDYxNSBDMTQwLjk4NzM4NCwxMzMuNDk0NjE1IDExNS4yMDEzNDMsMTU5LjI4MDY1NiAxMTUuMjAxMzQzLDE5MS4wODY4MTcgQzExNS4yMDEzNDMsMjIyLjg5Mjk3OSAxNDAuOTg3Mzg0LDI0OC42NzkwMiAxNzIuNzg5MzI0LDI0OC42NzkwMiBDMjA0LjYwMzkyOSwyNDguNjc5MDIgMjMwLjM4NTc0OSwyMjIuODkyOTc5IDIzMC4zODU3NDksMTkxLjA4NjgxNyIgZmlsbD0iIzAwOTkzOSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTcyLjc5MzU0NiwgMTkxLjA4NjgxNykgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtMTcyLjc5MzU0NiwgLTE5MS4wODY4MTcpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTE4NS41OTIwMDEsNTcuOTg0MzIxMyBDMTg1LjU5MjAwMSwyNi4xNzgxNTk3IDE1OS44MDU5NTksMC4zOTIxMTgzNDkgMTI3Ljk5OTc5OCwwLjM5MjExODM0OSBDOTYuMTkzNjM1OSwwLjM5MjExODM0OSA3MC40MDc1OTQ2LDI2LjE3ODE1OTcgNzAuNDA3NTk0Niw1Ny45ODQzMjEzIEM3MC40MDc1OTQ2LDg5Ljc5MDQ4MyA5Ni4xOTM2MzU5LDExNS41NzY1MjQgMTI3Ljk5OTc5OCwxMTUuNTc2NTI0IEMxNTkuODA1OTU5LDExNS41NzY1MjQgMTg1LjU5MjAwMSw4OS43OTA0ODMgMTg1LjU5MjAwMSw1Ny45ODQzMjEzIiBmaWxsPSIjQkYwMDAwIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMjcuOTk5Nzk4LCA1Ny45ODQzMjEpIHNjYWxlKDEsIC0xKSB0cmFuc2xhdGUoLTEyNy45OTk3OTgsIC01Ny45ODQzMjEpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTE0MC43OTg2NzUsNTcuOTc4ODMzMSBDMTQwLjc5ODY3NSw1Ni43NjcyMSAxNDAuOTA0MjE3LDU1LjU4MDkxNyAxNDAuOTgwMjA3LDU0LjM4NjE4MDcgQzE2Ni41MjU2MTIsNjAuMjc5NjUwNSAxODUuNTkwNzM0LDgzLjExODk1NjkgMTg1LjU5MDczNCwxMTAuNDU0MzU2IEMxODUuNTkwNzM0LDExMS42NjU5NzkgMTg1LjQ4NTE5MiwxMTIuODU2NDk0IDE4NS40MDkyMDIsMTE0LjA1MTIzIEMxNTkuODYzNzk2LDEwOC4xNTM1MzkgMTQwLjc5ODY3NSw4NS4zMTQyMzIyIDE0MC43OTg2NzUsNTcuOTc4ODMzMSIgZmlsbD0iI0ZDMDAwNyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTYzLjE5NDcwNCwgODQuMjE4NzA1KSBzY2FsZSgxLCAtMSkgdHJhbnNsYXRlKC0xNjMuMTk0NzA0LCAtODQuMjE4NzA1KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik0xNDguMzk2ODYsMTYyLjU3MDYxNCBDMTU4LjMyMjAzOCwxNDUuMjE5NDk1IDE3Ni45NzM0MzQsMTMzLjQ5NTg4MSAxOTguMzk0MjU1LDEzMy40OTU4ODEgQzIwNy4xMjQ2OTYsMTMzLjQ5NTg4MSAyMTUuMzY5NjQzLDEzNS40OTY5NTkgMjIyLjc4NzE0MSwxMzguOTc1NjI2IEMyMTIuODY2MTg1LDE1Ni4zMjY3NDQgMTk0LjIxNDc4OSwxNjguMDUwMzU4IDE3Mi43ODk3NDYsMTY4LjA1MDM1OCBDMTY0LjA1OTMwNSwxNjguMDUwMzU4IDE1NS44MTQzNTgsMTY2LjA0OTI4MSAxNDguMzk2ODYsMTYyLjU3MDYxNCIgZmlsbD0iIzFDRDMwNiIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTg1LjU5MjAwMSwgMTUwLjc3MzEyMCkgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtMTg1LjU5MjAwMSwgLTE1MC43NzMxMjApICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTExNS4yMDA0OTgsMTkxLjA4NjgxNyBDMTE1LjIwMDQ5OCwxNzcuMDE1OTQ3IDEyMC4yNTgwNzUsMTY0LjEzOTgxMyAxMjguNjQyMzM4LDE1NC4xMzg2NDYgQzEzNy4wMTgxNTcsMTY0LjEzOTgxMyAxNDIuMDc1NzM0LDE3Ny4wMTU5NDcgMTQyLjA3NTczNCwxOTEuMDg2ODE3IEMxNDIuMDc1NzM0LDIwNS4xNTc2ODggMTM3LjAxODE1NywyMTguMDMzODIyIDEyOC42NDIzMzgsMjI4LjAzNDk4OSBDMTIwLjI1ODA3NSwyMTguMDMzODIyIDExNS4yMDA0OTgsMjA1LjE1NzY4OCAxMTUuMjAwNDk4LDE5MS4wODY4MTciIGZpbGw9IiMwRjc1MDQiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEyOC42MzgxMTYsIDE5MS4wODY4MTcpIHNjYWxlKDEsIC0xKSB0cmFuc2xhdGUoLTEyOC42MzgxMTYsIC0xOTEuMDg2ODE3KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik0zNC44MDY5ODQsMTM4LjIxMjc2OCBDNDEuODAyMzEzMiwxMzUuMTkwMDQzIDQ5LjUwMjY2MzUsMTMzLjQ5NzE0OCA1Ny42MDgyOTUzLDEzMy40OTcxNDggQzc4LjgxODAzMiwxMzMuNDk3MTQ4IDk3LjI5NjMzOTYsMTQ0Ljk5Mjc5MSAxMDcuMjkzMjg2LDE2Mi4wNjEwNTYgQzEwMC4yOTc5NTYsMTY1LjA4Mzc4MiA5Mi41OTMzODQ0LDE2Ni43NzI0NTUgODQuNDkxOTc0MywxNjYuNzcyNDU1IEM2My4yODIyMzc2LDE2Ni43NzI0NTUgNDQuNzk5NzA4MywxNTUuMjc2ODExIDM0LjgwNjk4NCwxMzguMjEyNzY4IiBmaWxsPSIjMEM1RTg3IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg3MS4wNTAxMzUsIDE1MC4xMzQ4MDEpIHNjYWxlKDEsIC0xKSB0cmFuc2xhdGUoLTcxLjA1MDEzNSwgLTE1MC4xMzQ4MDEpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTcwLjY1NDU2MzEsMTE0LjAzNjAzMiBDNzAuNTE5NDY5MiwxMTIuNDMxNzkyIDcwLjQwNTQ4MzgsMTEwLjgxOTEwOSA3MC40MDU0ODM4LDEwOS4xNzY4NzUgQzcwLjQwNTQ4MzgsODEuODYyNTg0IDg5LjQ0MTA1MzYsNTkuMDQ0Mzg2IDExNC45NTY5MDcsNTMuMTI1NTg2MSBDMTE1LjA4Nzc3OSw1NC43Mjk4MjU3IDExNS4yMDE3NjUsNTYuMzQyNTA4NyAxMTUuMjAxNzY1LDU3Ljk4MDUyMTggQzExNS4yMDE3NjUsODUuMjk0ODEyNSA5Ni4xNzA0MTY3LDEwOC4xMjE0NTQgNzAuNjU0NTYzMSwxMTQuMDM2MDMyIiBmaWxsPSIjNkIwMDAxIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg5Mi44MDM2MjQsIDgzLjU4MDgwOSkgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtOTIuODAzNjI0LCAtODMuNTgwODA5KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik03Ni4wMzA0NTQ1LDExMS41MDM4NjYgTDY3LjAyMTM4MjUsMTExLjUwMzg2NiBDNTkuMDY3NzMxMiwxMTEuNTAzODY2IDUyLjYwMDExMjUsMTE3Ljk1MDM3NyA1Mi42MDAxMTI1LDEyNS44ODI5MiBMNTIuNjAwMTEyNSwyMDcuNDI4OTUzIEM1Mi42MDAxMTI1LDIxNS4zNjE0OTYgNTkuMDY3NzMxMiwyMjEuODEyMjI4IDY3LjAyMTM4MjUsMjIxLjgxMjIyOCBMMTc5Ljk4OTQwNSwyMjEuODEyMjI4IEMxODcuOTQzMDU2LDIyMS44MTIyMjggMTk0LjQwNjQ1MywyMTUuMzYxNDk2IDE5NC40MDY0NTMsMjA3LjQyODk1MyBMMTk0LjQwNjQ1MywxMjUuODgyOTIgQzE5NC40MDY0NTMsMTE3Ljk1MDM3NyAxODcuOTQzMDU2LDExMS41MDM4NjYgMTc5Ljk4OTQwNSwxMTEuNTAzODY2IEwxNDEuNTA0NTQsMTExLjUwMzg2NiBMNjQuMjg5OTUzNCw3My42NTIyNTQ0IEw3Ni4wMzA0NTQ1LDExMS41MDM4NjYgTDc2LjAzMDQ1NDUsMTExLjUwMzg2NiBaIiBmaWxsPSIjRkZGRkZGIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMjMuNTAzMjgzLCAxNDcuNzMyMjQxKSBzY2FsZSgxLCAtMSkgdHJhbnNsYXRlKC0xMjMuNTAzMjgzLCAtMTQ3LjczMjI0MSkgIj4KDTwvcGF0aD4KCTwvZz4KPC9zdmc+";
        this.blockIconURI = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gVXBsb2FkZWQgdG86IFNWRyBSZXBvLCB3d3cuc3ZncmVwby5jb20sIEdlbmVyYXRvcjogU1ZHIFJlcG8gTWl4ZXIgVG9vbHMgLS0+Cjxzdmcgd2lkdGg9IjgwMHB4IiBoZWlnaHQ9IjgwMHB4IiB2aWV3Qm94PSIwIC0zLjUgMjU2IDI1NiIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1pZCI+Cgk8Zz4KCQk8cGF0aCBkPSJNMTQyLjA3NjU3OCwxOTEuMDg2ODE3IEMxNDIuMDc2NTc4LDE1OS4yODA2NTYgMTE2LjI5NDc1OSwxMzMuNDk0NjE1IDg0LjQ4ODU5NjksMTMzLjQ5NDYxNSBDNTIuNjc4MjEzNiwxMzMuNDk0NjE1IDI2Ljg5NjM5NCwxNTkuMjgwNjU2IDI2Ljg5NjM5NCwxOTEuMDg2ODE3IEMyNi44OTYzOTQsMjIyLjg5Mjk3OSA1Mi42NzgyMTM2LDI0OC42NzkwMiA4NC40ODg1OTY5LDI0OC42NzkwMiBDMTE2LjI5NDc1OSwyNDguNjc5MDIgMTQyLjA3NjU3OCwyMjIuODkyOTc5IDE0Mi4wNzY1NzgsMTkxLjA4NjgxNyIgZmlsbD0iI0ZGNjYwMCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoODQuNDg2NDg2LCAxOTEuMDg2ODE3KSBzY2FsZSgxLCAtMSkgdHJhbnNsYXRlKC04NC40ODY0ODYsIC0xOTEuMDg2ODE3KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik0yNTUuOTc5NzAzLDExMC40NTQzNTYgQzI1NS45Nzk3MDMsNzguNjUyNDE2IDIzMC4xOTc4ODQsNTIuODYyMTUzIDE5OC4zOTE3MjIsNTIuODYyMTUzIEMxNjYuNTgxMzM5LDUyLjg2MjE1MyAxNDAuNzk5NTE5LDc4LjY1MjQxNiAxNDAuNzk5NTE5LDExMC40NTQzNTYgQzE0MC43OTk1MTksMTQyLjI2MDUxOCAxNjYuNTgxMzM5LDE2OC4wNTA3ODEgMTk4LjM5MTcyMiwxNjguMDUwNzgxIEMyMzAuMTk3ODg0LDE2OC4wNTA3ODEgMjU1Ljk3OTcwMywxNDIuMjYwNTE4IDI1NS45Nzk3MDMsMTEwLjQ1NDM1NiIgZmlsbD0iI0ZGQ0MwMCIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTk4LjM4OTYxMSwgMTEwLjQ1NjQ2Nykgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtMTk4LjM4OTYxMSwgLTExMC40NTY0NjcpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTExNS4yMDA0OTgsMTA5LjE3NjQ1MiBDMTE1LjIwMDQ5OCw3Ny4zNzQ1MTI1IDg5LjQxODY3ODYsNTEuNTg0MjQ5NSA1Ny42MDgyOTUzLDUxLjU4NDI0OTUgQzI1LjgwNjM1NTMsNTEuNTg0MjQ5NSAwLjAyMDMxNDAyNzEsNzcuMzc0NTEyNSAwLjAyMDMxNDAyNzEsMTA5LjE3NjQ1MiBDMC4wMjAzMTQwMjcxLDE0MC45ODI2MTQgMjUuODA2MzU1MywxNjYuNzcyODc3IDU3LjYwODI5NTMsMTY2Ljc3Mjg3NyBDODkuNDE4Njc4NiwxNjYuNzcyODc3IDExNS4yMDA0OTgsMTQwLjk4MjYxNCAxMTUuMjAwNDk4LDEwOS4xNzY0NTIiIGZpbGw9IiMwMDg5Q0MiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU3LjYxMDQwNiwgMTA5LjE3ODU2Mykgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtNTcuNjEwNDA2LCAtMTA5LjE3ODU2MykgIj4KDTwvcGF0aD4KCQk8cGF0aCBkPSJNMjMwLjM4NTc0OSwxOTEuMDg2ODE3IEMyMzAuMzg1NzQ5LDE1OS4yODA2NTYgMjA0LjYwMzkyOSwxMzMuNDk0NjE1IDE3Mi43ODkzMjQsMTMzLjQ5NDYxNSBDMTQwLjk4NzM4NCwxMzMuNDk0NjE1IDExNS4yMDEzNDMsMTU5LjI4MDY1NiAxMTUuMjAxMzQzLDE5MS4wODY4MTcgQzExNS4yMDEzNDMsMjIyLjg5Mjk3OSAxNDAuOTg3Mzg0LDI0OC42NzkwMiAxNzIuNzg5MzI0LDI0OC42NzkwMiBDMjA0LjYwMzkyOSwyNDguNjc5MDIgMjMwLjM4NTc0OSwyMjIuODkyOTc5IDIzMC4zODU3NDksMTkxLjA4NjgxNyIgZmlsbD0iIzAwOTkzOSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTcyLjc5MzU0NiwgMTkxLjA4NjgxNykgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtMTcyLjc5MzU0NiwgLTE5MS4wODY4MTcpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTE4NS41OTIwMDEsNTcuOTg0MzIxMyBDMTg1LjU5MjAwMSwyNi4xNzgxNTk3IDE1OS44MDU5NTksMC4zOTIxMTgzNDkgMTI3Ljk5OTc5OCwwLjM5MjExODM0OSBDOTYuMTkzNjM1OSwwLjM5MjExODM0OSA3MC40MDc1OTQ2LDI2LjE3ODE1OTcgNzAuNDA3NTk0Niw1Ny45ODQzMjEzIEM3MC40MDc1OTQ2LDg5Ljc5MDQ4MyA5Ni4xOTM2MzU5LDExNS41NzY1MjQgMTI3Ljk5OTc5OCwxMTUuNTc2NTI0IEMxNTkuODA1OTU5LDExNS41NzY1MjQgMTg1LjU5MjAwMSw4OS43OTA0ODMgMTg1LjU5MjAwMSw1Ny45ODQzMjEzIiBmaWxsPSIjQkYwMDAwIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMjcuOTk5Nzk4LCA1Ny45ODQzMjEpIHNjYWxlKDEsIC0xKSB0cmFuc2xhdGUoLTEyNy45OTk3OTgsIC01Ny45ODQzMjEpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTE0MC43OTg2NzUsNTcuOTc4ODMzMSBDMTQwLjc5ODY3NSw1Ni43NjcyMSAxNDAuOTA0MjE3LDU1LjU4MDkxNyAxNDAuOTgwMjA3LDU0LjM4NjE4MDcgQzE2Ni41MjU2MTIsNjAuMjc5NjUwNSAxODUuNTkwNzM0LDgzLjExODk1NjkgMTg1LjU5MDczNCwxMTAuNDU0MzU2IEMxODUuNTkwNzM0LDExMS42NjU5NzkgMTg1LjQ4NTE5MiwxMTIuODU2NDk0IDE4NS40MDkyMDIsMTE0LjA1MTIzIEMxNTkuODYzNzk2LDEwOC4xNTM1MzkgMTQwLjc5ODY3NSw4NS4zMTQyMzIyIDE0MC43OTg2NzUsNTcuOTc4ODMzMSIgZmlsbD0iI0ZDMDAwNyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTYzLjE5NDcwNCwgODQuMjE4NzA1KSBzY2FsZSgxLCAtMSkgdHJhbnNsYXRlKC0xNjMuMTk0NzA0LCAtODQuMjE4NzA1KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik0xNDguMzk2ODYsMTYyLjU3MDYxNCBDMTU4LjMyMjAzOCwxNDUuMjE5NDk1IDE3Ni45NzM0MzQsMTMzLjQ5NTg4MSAxOTguMzk0MjU1LDEzMy40OTU4ODEgQzIwNy4xMjQ2OTYsMTMzLjQ5NTg4MSAyMTUuMzY5NjQzLDEzNS40OTY5NTkgMjIyLjc4NzE0MSwxMzguOTc1NjI2IEMyMTIuODY2MTg1LDE1Ni4zMjY3NDQgMTk0LjIxNDc4OSwxNjguMDUwMzU4IDE3Mi43ODk3NDYsMTY4LjA1MDM1OCBDMTY0LjA1OTMwNSwxNjguMDUwMzU4IDE1NS44MTQzNTgsMTY2LjA0OTI4MSAxNDguMzk2ODYsMTYyLjU3MDYxNCIgZmlsbD0iIzFDRDMwNiIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTg1LjU5MjAwMSwgMTUwLjc3MzEyMCkgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtMTg1LjU5MjAwMSwgLTE1MC43NzMxMjApICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTExNS4yMDA0OTgsMTkxLjA4NjgxNyBDMTE1LjIwMDQ5OCwxNzcuMDE1OTQ3IDEyMC4yNTgwNzUsMTY0LjEzOTgxMyAxMjguNjQyMzM4LDE1NC4xMzg2NDYgQzEzNy4wMTgxNTcsMTY0LjEzOTgxMyAxNDIuMDc1NzM0LDE3Ny4wMTU5NDcgMTQyLjA3NTczNCwxOTEuMDg2ODE3IEMxNDIuMDc1NzM0LDIwNS4xNTc2ODggMTM3LjAxODE1NywyMTguMDMzODIyIDEyOC42NDIzMzgsMjI4LjAzNDk4OSBDMTIwLjI1ODA3NSwyMTguMDMzODIyIDExNS4yMDA0OTgsMjA1LjE1NzY4OCAxMTUuMjAwNDk4LDE5MS4wODY4MTciIGZpbGw9IiMwRjc1MDQiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDEyOC42MzgxMTYsIDE5MS4wODY4MTcpIHNjYWxlKDEsIC0xKSB0cmFuc2xhdGUoLTEyOC42MzgxMTYsIC0xOTEuMDg2ODE3KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik0zNC44MDY5ODQsMTM4LjIxMjc2OCBDNDEuODAyMzEzMiwxMzUuMTkwMDQzIDQ5LjUwMjY2MzUsMTMzLjQ5NzE0OCA1Ny42MDgyOTUzLDEzMy40OTcxNDggQzc4LjgxODAzMiwxMzMuNDk3MTQ4IDk3LjI5NjMzOTYsMTQ0Ljk5Mjc5MSAxMDcuMjkzMjg2LDE2Mi4wNjEwNTYgQzEwMC4yOTc5NTYsMTY1LjA4Mzc4MiA5Mi41OTMzODQ0LDE2Ni43NzI0NTUgODQuNDkxOTc0MywxNjYuNzcyNDU1IEM2My4yODIyMzc2LDE2Ni43NzI0NTUgNDQuNzk5NzA4MywxNTUuMjc2ODExIDM0LjgwNjk4NCwxMzguMjEyNzY4IiBmaWxsPSIjMEM1RTg3IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg3MS4wNTAxMzUsIDE1MC4xMzQ4MDEpIHNjYWxlKDEsIC0xKSB0cmFuc2xhdGUoLTcxLjA1MDEzNSwgLTE1MC4xMzQ4MDEpICI+Cg08L3BhdGg+CgkJPHBhdGggZD0iTTcwLjY1NDU2MzEsMTE0LjAzNjAzMiBDNzAuNTE5NDY5MiwxMTIuNDMxNzkyIDcwLjQwNTQ4MzgsMTEwLjgxOTEwOSA3MC40MDU0ODM4LDEwOS4xNzY4NzUgQzcwLjQwNTQ4MzgsODEuODYyNTg0IDg5LjQ0MTA1MzYsNTkuMDQ0Mzg2IDExNC45NTY5MDcsNTMuMTI1NTg2MSBDMTE1LjA4Nzc3OSw1NC43Mjk4MjU3IDExNS4yMDE3NjUsNTYuMzQyNTA4NyAxMTUuMjAxNzY1LDU3Ljk4MDUyMTggQzExNS4yMDE3NjUsODUuMjk0ODEyNSA5Ni4xNzA0MTY3LDEwOC4xMjE0NTQgNzAuNjU0NTYzMSwxMTQuMDM2MDMyIiBmaWxsPSIjNkIwMDAxIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg5Mi44MDM2MjQsIDgzLjU4MDgwOSkgc2NhbGUoMSwgLTEpIHRyYW5zbGF0ZSgtOTIuODAzNjI0LCAtODMuNTgwODA5KSAiPgoNPC9wYXRoPgoJCTxwYXRoIGQ9Ik03Ni4wMzA0NTQ1LDExMS41MDM4NjYgTDY3LjAyMTM4MjUsMTExLjUwMzg2NiBDNTkuMDY3NzMxMiwxMTEuNTAzODY2IDUyLjYwMDExMjUsMTE3Ljk1MDM3NyA1Mi42MDAxMTI1LDEyNS44ODI5MiBMNTIuNjAwMTEyNSwyMDcuNDI4OTUzIEM1Mi42MDAxMTI1LDIxNS4zNjE0OTYgNTkuMDY3NzMxMiwyMjEuODEyMjI4IDY3LjAyMTM4MjUsMjIxLjgxMjIyOCBMMTc5Ljk4OTQwNSwyMjEuODEyMjI4IEMxODcuOTQzMDU2LDIyMS44MTIyMjggMTk0LjQwNjQ1MywyMTUuMzYxNDk2IDE5NC40MDY0NTMsMjA3LjQyODk1MyBMMTk0LjQwNjQ1MywxMjUuODgyOTIgQzE5NC40MDY0NTMsMTE3Ljk1MDM3NyAxODcuOTQzMDU2LDExMS41MDM4NjYgMTc5Ljk4OTQwNSwxMTEuNTAzODY2IEwxNDEuNTA0NTQsMTExLjUwMzg2NiBMNjQuMjg5OTUzNCw3My42NTIyNTQ0IEw3Ni4wMzA0NTQ1LDExMS41MDM4NjYgTDc2LjAzMDQ1NDUsMTExLjUwMzg2NiBaIiBmaWxsPSIjRkZGRkZGIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSgxMjMuNTAzMjgzLCAxNDcuNzMyMjQxKSBzY2FsZSgxLCAtMSkgdHJhbnNsYXRlKC0xMjMuNTAzMjgzLCAtMTQ3LjczMjI0MSkgIj4KDTwvcGF0aD4KCTwvZz4KPC9zdmc+";
      }
      // Define blocks used in the extension
      getInfo() {
        return {
          id: "webrtc",
          name: "WebRTC",
          color1: "#f6a639",
          color2: "#a56d22",
          menuIconURI: this.menuIconURI,
          blockIconURI: this.blockIconURI,
          docsURI: "https://github.com/cloudlink-omega/scratch3-webrtc",
          blocks: [
            {
              opcode: "allPeers",
              blockType: Scratch2.BlockType.REPORTER,
              text: "All peer connection objects"
            },
            {
              opcode: "allConnectedPeers",
              blockType: Scratch2.BlockType.REPORTER,
              text: "All connected peers"
            },
            {
              opcode: "allPeerChannels",
              blockType: Scratch2.BlockType.REPORTER,
              text: "All channels of peer [peer]",
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              }
            },
            {
              opcode: "newPeer",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                name: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Create peer [name] connection object"
            },
            {
              opcode: "closePeer",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                name: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Close peer [name] connection object"
            },
            {
              opcode: "isPeerConnected",
              blockType: Scratch2.BlockType.BOOLEAN,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Is peer [peer] connected?"
            },
            {
              opcode: "createOffer",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Make an offer for peer [peer]"
            },
            {
              opcode: "getOffer",
              blockType: Scratch2.BlockType.REPORTER,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Offer for peer [peer]"
            },
            {
              opcode: "createAnswer",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                },
                offer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "offer"
                }
              },
              text: "Make answer for peer [peer] using offer [offer]"
            },
            {
              opcode: "getAnswer",
              blockType: Scratch2.BlockType.REPORTER,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Answer for peer [peer]"
            },
            {
              opcode: "generateIce",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Gather ICE candidates for peer [peer]"
            },
            {
              opcode: "getIce",
              blockType: Scratch2.BlockType.REPORTER,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "All ICE candidates for peer [peer]"
            },
            {
              opcode: "handleAnswer",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                answer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "answer"
                },
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Handle peer [peer]'s answer [answer]"
            },
            {
              opcode: "handleIce",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                ice: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "ice"
                },
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Handle peer [peer]'s ICE candidates [ice]"
            },
            {
              opcode: "sendData",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                data: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "banana"
                },
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                },
                channel: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "default"
                },
                wait: {
                  type: Scratch2.ArgumentType.BOOLEAN,
                  defaultValue: false
                }
              },
              text: "Send [data] to peer [peer] using channel [channel] and wait? [wait]"
            },
            {
              opcode: "getData",
              blockType: Scratch2.BlockType.REPORTER,
              arguments: {
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                },
                channel: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "default"
                }
              },
              text: "Data from peer [peer] in channel [channel]"
            },
            {
              opcode: "createChannel",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                channel: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "default"
                },
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                },
                ordered: {
                  type: Scratch2.ArgumentType.BOOLEAN,
                  defaultValue: false
                }
              },
              text: "Create data channel [channel] with peer [peer] and is this channel ordered? [ordered]"
            },
            {
              opcode: "closeChannel",
              blockType: Scratch2.BlockType.COMMAND,
              arguments: {
                channel: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "default"
                },
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Close data channel [channel] with peer [peer]"
            },
            {
              opcode: "isChannelOpen",
              blockType: Scratch2.BlockType.BOOLEAN,
              arguments: {
                channel: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "default"
                },
                peer: {
                  type: Scratch2.ArgumentType.STRING,
                  defaultValue: "apple"
                }
              },
              text: "Does data channel [channel] with peer [peer] exist?"
            }
          ]
        };
      }
      allConnectedPeers() {
        return JSON.stringify(webrtc.getConnectedPeers());
      }
      async newPeer(args) {
        const name = args.name;
        if (webrtc.dataConnections.has(name)) {
          console.warn(`Peer ${name} already exists`);
          return;
        }
        await webrtc.getConnectionObject(name, 0);
      }
      closePeer(args) {
        const name = args.name;
        if (!webrtc.dataConnections.has(name)) {
          console.warn(`Peer ${name} does not exist`);
          return;
        }
        webrtc.closeDataConnection(name);
      }
      getData(args) {
        const result = webrtc.getChannelData(args.peer, args.channel);
        if (result === void 0)
          return "";
        return result;
      }
      sendData(args) {
        return webrtc.sendData(args.peer, args.channel, args.data, args.wait);
      }
      createChannel(args) {
        const channel = args.channel;
        const peer = args.peer;
        if (webrtc.doesPeerChannelExist(peer, channel)) {
          console.warn(`Channel ${channel} already exists with peer ${peer}`);
          return;
        }
        webrtc.createDataChannel(peer, channel, args.ordered);
      }
      closeChannel(args) {
        const channel = args.channel;
        const peer = args.peer;
        if (!webrtc.doesPeerChannelExist(peer, channel)) {
          console.warn(`Channel ${channel} does not exist with peer ${peer}`);
          return;
        }
        if (channel == "default") {
          console.warn(
            "Cannot close default channel, use the close connection block instead"
          );
          return;
        }
        webrtc.closeChannel(peer, channel);
      }
      isChannelOpen(args) {
        return webrtc.doesPeerChannelExist(args.peer, args.channel);
      }
      getOffer(args) {
        return this.offers[args.peer] ? btoa(JSON.stringify(this.offers[args.peer])) : "";
      }
      async createOffer(args) {
        this.offers[args.peer] = await webrtc.createOffer(args.peer, args.peer, 0);
      }
      getAnswer(args) {
        return this.answers[args.peer] ? btoa(JSON.stringify(this.answers[args.peer])) : "";
      }
      async createAnswer(args) {
        this.answers[args.peer] = await webrtc.createAnswer(
          args.peer,
          args.peer,
          0,
          JSON.parse(atob(args.offer))
        );
      }
      async handleAnswer(args) {
        await webrtc.handleAnswer(args.peer, 0, JSON.parse(atob(args.answer)));
      }
      async generateIce(args) {
        await until(() => webrtc.doneGatheringIce(args.peer));
      }
      getIce(args) {
        const result = webrtc.allIceCandidates(args.peer);
        if (result.length == 0)
          return "";
        return btoa(JSON.stringify(result));
      }
      handleIce(args) {
        const candidates = JSON.parse(atob(args.ice));
        for (const key in candidates) {
          webrtc.handleIceCandidate(args.peer, 0, candidates[key]);
        }
      }
      isPeerConnected(args) {
        return webrtc.isPeerConnected(args.peer);
      }
      allPeers() {
        return JSON.stringify(webrtc.getPeers());
      }
      allPeerChannels(args) {
        return JSON.stringify(webrtc.getPeerChannels(args.peer));
      }
    }
    if (Scratch2.vm?.runtime) {
      Scratch2.extensions.register(new ScratchWebRTC(Scratch2.vm));
    } else {
      throw new Error(
        "This extension is not supported in this Scratch Mod because it does not expose a `vm` property."
      );
    }
  })(Scratch);
})();
