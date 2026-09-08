import { config } from '../config';
import { dbService, RecordingSession, RecordingFile } from './db.service';
import { agoraService } from './voice/agora.service';

const AGORA_API_BASE = 'https://api.agora.io/v1/apps';

export class AgoraRecordingService {
  private static getBasicAuthHeader(): string | null {
    if (!config.agora.customerId || !config.agora.customerSecret) {
      return null;
    }
    const token = Buffer.from(`${config.agora.customerId}:${config.agora.customerSecret}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Acquire a resource ID from Agora Cloud Recording API
   */
  public static async acquireResource(
    channelName: string,
    recordingUid: number
  ): Promise<string> {
    const authHeader = this.getBasicAuthHeader();
    if (!authHeader || !config.agora.appId) {
      // In dev / test mode without cloud recording credentials
      const mockResourceId = `res_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      console.log(`[RECORDING] Dev mode / mock acquire: ${mockResourceId}`);
      return mockResourceId;
    }

    const url = `${AGORA_API_BASE}/${config.agora.appId}/cloud_recording/acquire`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cname: channelName,
        uid: String(recordingUid),
        clientRequest: {
          resourceExpiredHour: 24,
          scene: 0,
        },
      }),
    });

    const data: any = await response.json();
    if (!data || !data.resourceId) {
      throw new Error(`Agora acquire failed: ${JSON.stringify(data)}`);
    }

    return data.resourceId;
  }

  /**
   * Start a cloud recording session
   */
  public static async startRecording(
    classId: string,
    channelName: string,
    _startedByUserId: string
  ): Promise<RecordingSession> {
    const upperClassId = classId.toUpperCase();

    // Check if there is already an active recording for this class
    const existing = dbService.getActiveRecordingSession(upperClassId);
    if (existing) {
      return existing;
    }

    const recordingUid = 999999; // Dedicated recorder UID
    const resourceId = await this.acquireResource(channelName, recordingUid);
    const tokenResult = agoraService.generateRtcToken(channelName, recordingUid, 'publisher');
    const rtcToken = tokenResult.token;

    const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const activeMeeting = dbService.getActiveMeetingSession(upperClassId);

    const authHeader = this.getBasicAuthHeader();

    if (!authHeader || !config.agora.appId || !config.recording.isStorageConfigured) {
      // Create local simulated session for dev/demo testing
      const simSession: RecordingSession = {
        id: recordingId,
        classId: upperClassId,
        meetingSessionId: activeMeeting?.id,
        resourceId,
        sid: `sid_mock_${Date.now()}`,
        agoraChannel: channelName,
        recordingUid,
        startedAt: now,
        status: 'RECORDING',
        storageMode: 'local_mock',
        fileList: [
          {
            filename: `${channelName}_${Date.now()}.mp4`,
            trackType: 'audio_and_video',
            url: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
            sliceStartTime: Date.now(),
          },
        ],
      };
      dbService.saveRecordingSession(simSession);
      console.log(`[RECORDING_STARTED] (Mock Mode) class=${upperClassId} id=${recordingId}`);
      return simSession;
    }

    const url = `${AGORA_API_BASE}/${config.agora.appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`;

    const body = {
      cname: channelName,
      uid: String(recordingUid),
      clientRequest: {
        token: rtcToken,
        recordingConfig: {
          maxIdleTime: 120,
          streamTypes: 2, // 2: audio & video
          audioProfile: 1,
          channelType: 1,
          videoStreamType: 0,
          transcodingConfig: {
            width: 1280,
            height: 720,
            fps: 30,
            bitrate: 1500,
            mixedVideoLayout: 1, // 1 = Floating layout
            backgroundColor: '#0F172A',
          },
        },
        recordingFileConfig: {
          avFileType: ['hls', 'mp4'],
        },
        storageConfig: {
          vendor: config.recording.vendor,
          region: config.recording.region,
          bucket: config.recording.bucket,
          accessKey: config.recording.accessKey,
          secretKey: config.recording.secretKey,
          fileNamePrefix: ['classpulse_recordings', upperClassId],
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data: any = await response.json();
      if (!response.ok || !data?.sid) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }

      const sid = data.sid;
      const session: RecordingSession = {
        id: recordingId,
        classId: upperClassId,
        meetingSessionId: activeMeeting?.id,
        resourceId,
        sid,
        agoraChannel: channelName,
        recordingUid,
        startedAt: now,
        status: 'RECORDING',
        storageMode: config.recording.vendor === 6 ? 'gcs' : 's3',
      };

      dbService.saveRecordingSession(session);
      console.log(`[RECORDING_STARTED] (Agora Cloud) class=${upperClassId} sid=${sid}`);
      return session;
    } catch (err: any) {
      console.error('[RECORDING_START_ERROR]', err.message);
      throw new Error(`Failed to start Agora Cloud Recording: ${err.message}`);
    }
  }

  /**
   * Stop an active cloud recording session
   */
  public static async stopRecording(
    classId: string,
    channelName: string
  ): Promise<RecordingSession> {
    const upperClassId = classId.toUpperCase();
    const active = dbService.getActiveRecordingSession(upperClassId);
    if (!active) {
      throw new Error(`No active recording found for class ${upperClassId}`);
    }

    const now = new Date().toISOString();
    const durationSeconds = Math.max(
      1,
      Math.round((new Date(now).getTime() - new Date(active.startedAt).getTime()) / 1000)
    );

    const authHeader = this.getBasicAuthHeader();

    if (!authHeader || !config.agora.appId || active.storageMode === 'local_mock') {
      const updated = dbService.updateRecordingSession(active.id, {
        status: 'STOPPED',
        stoppedAt: now,
        durationSeconds,
      })!;
      console.log(`[RECORDING_STOPPED] (Mock Mode) class=${upperClassId} id=${active.id} duration=${durationSeconds}s`);
      return updated;
    }

    const url = `${AGORA_API_BASE}/${config.agora.appId}/cloud_recording/resourceid/${active.resourceId}/sid/${active.sid}/mode/mix/stop`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cname: channelName,
          uid: String(active.recordingUid),
          clientRequest: {
            async_stop: false,
          },
        }),
      });

      const data: any = await response.json();
      const serverResponse = data?.serverResponse || {};
      const fileListRaw = serverResponse?.fileList;
      let parsedFiles: RecordingFile[] = [];

      if (Array.isArray(fileListRaw)) {
        parsedFiles = fileListRaw.map((f: any) => ({
          filename: f.filename || '',
          trackType: f.trackType || 'audio_and_video',
          sliceStartTime: f.sliceStartTime,
          url: f.filename ? `https://${config.recording.bucket}.s3.amazonaws.com/${f.filename}` : undefined,
        }));
      }

      const updated = dbService.updateRecordingSession(active.id, {
        status: 'STOPPED',
        stoppedAt: now,
        durationSeconds,
        fileList: parsedFiles.length > 0 ? parsedFiles : active.fileList,
      })!;

      console.log(`[RECORDING_STOPPED] (Agora Cloud) class=${upperClassId} sid=${active.sid}`);
      return updated;
    } catch (err: any) {
      console.error('[RECORDING_STOP_ERROR]', err.message);
      const updated = dbService.updateRecordingSession(active.id, {
        status: 'STOPPED',
        stoppedAt: now,
        durationSeconds,
        error: err?.message,
      })!;
      return updated;
    }
  }

  /**
   * Query status and files of a recording session
   */
  public static async queryRecording(recordingId: string): Promise<RecordingSession | undefined> {
    const session = dbService.getRecordingSession(recordingId);
    if (!session) return undefined;

    if (session.status === 'STOPPED' || session.storageMode === 'local_mock') {
      return session;
    }

    const authHeader = this.getBasicAuthHeader();
    if (!authHeader || !config.agora.appId) return session;

    try {
      const url = `${AGORA_API_BASE}/${config.agora.appId}/cloud_recording/resourceid/${session.resourceId}/sid/${session.sid}/mode/mix/query`;
      const response = await fetch(url, {
        headers: {
          Authorization: authHeader,
        },
      });

      const data: any = await response.json();
      const serverResponse = data?.serverResponse;
      if (serverResponse) {
        const statusNum = serverResponse.status;
        if (statusNum === 3 || statusNum === 4) {
          session.status = 'STOPPED';
        }
        if (Array.isArray(serverResponse.fileList)) {
          session.fileList = serverResponse.fileList.map((f: any) => ({
            filename: f.filename || '',
            trackType: f.trackType || 'audio_and_video',
            sliceStartTime: f.sliceStartTime,
            url: f.filename ? `https://${config.recording.bucket}.s3.amazonaws.com/${f.filename}` : undefined,
          }));
        }
        dbService.updateRecordingSession(session.id, session);
      }
      return session;
    } catch {
      return session;
    }
  }
}
