import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Check, X, AlertCircle, Sparkles, Upload } from 'lucide-react';
import { ERPModal, ERPBtn, C } from '../../erp/components/ERPui';
import { captureVideoToMonochrome, processFileToMonochrome } from '../attendanceCamera';
import { fmtTime } from '../staffUtils';

export default function SelfieModal({
  isOpen,
  onClose,
  onConfirm,
  actionType = 'checkin', // 'checkin' | 'checkout'
  staffName = '',
}) {
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [captured, setCaptured] = useState(null); // { dataUrl, sizeKb, timestamp }
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const isCheckIn = actionType === 'checkin';
  const title = isCheckIn ? 'Check-in Selfie Verification' : 'Check-out Selfie Verification';

  // Start camera stream when modal is opened and not yet captured
  useEffect(() => {
    if (!isOpen || captured) return;

    let activeStream = null;
    let isCancelled = false;

    const startCamera = async () => {
      setCameraError('');
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by your browser.');
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false,
        });

        if (isCancelled) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.warn('Camera stream error:', err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera permission was denied. Please allow camera access or use the fallback camera upload.'
            : (err.message || 'Could not start camera.')
        );
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [isOpen, captured, facingMode]);

  // Clean up stream on modal close
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setCaptured(null);
    setCameraError('');
    onClose();
  };

  // Flip front/back camera
  const toggleFacingMode = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture frame from live video
  const handleCapture = async () => {
    if (!videoRef.current) return;
    setProcessing(true);
    try {
      const result = await captureVideoToMonochrome(videoRef.current, {
        maxDim: 360,
        quality: 0.65,
      });
      // Stop stream now that photo is taken
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      setCaptured(result);
    } catch (err) {
      console.error('Capture failed:', err);
      setCameraError('Capture failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Fallback image upload from camera / files
  const handleFileUpload = async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    try {
      const result = await processFileToMonochrome(file, {
        maxDim: 360,
        quality: 0.65,
      });
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        setStream(null);
      }
      setCaptured(result);
    } catch (err) {
      console.error('File process failed:', err);
      setCameraError('Image processing failed: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Retake photo
  const handleRetake = () => {
    setCaptured(null);
    setCameraError('');
  };

  // Confirm photo and punch
  const handleConfirm = () => {
    if (!captured) return;
    onConfirm(captured);
    handleClose();
  };

  return (
    <ERPModal isOpen={isOpen} onClose={handleClose} title={title} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        {staffName && (
          <div style={{ fontSize: 12, color: C.muted }}>
            Staff Member: <strong style={{ color: C.subtle }}>{staffName}</strong>
          </div>
        )}

        <div style={{
          width: '100%',
          maxWidth: 340,
          aspectRatio: '1 / 1',
          background: '#030814',
          borderRadius: 20,
          border: `2px solid ${captured ? C.green : C.blue}40`,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.6)',
        }}>
          {!captured ? (
            <>
              {/* Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                  display: stream ? 'block' : 'none',
                }}
              />

              {/* Guiding Oval / Face Guide */}
              {stream && (
                <div style={{
                  position: 'absolute',
                  inset: 24,
                  borderRadius: '50%',
                  border: '2px dashed rgba(255,255,255,0.4)',
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 12,
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.75)',
                    background: 'rgba(0,0,0,0.5)',
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}>
                    Center Face Here
                  </div>
                </div>
              )}

              {/* Camera loading / error placeholder */}
              {!stream && (
                <div style={{ padding: 24, textAlign: 'center', color: C.muted }}>
                  {cameraError ? (
                    <div style={{ color: C.amber, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                      <AlertCircle size={32} />
                      <div>{cameraError}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        You can still take a selfie using your phone camera or file upload:
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                      <Camera size={32} style={{ color: C.blue, animation: 'pulse 1.5s infinite' }} />
                      <div>Initializing camera…</div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Monochrome Optimized Preview */
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <img
                src={captured.dataUrl}
                alt="Selfie Monochrome Preview"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'grayscale(100%)',
                }}
              />
              <div style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'rgba(24,199,122,0.9)',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Sparkles size={11} /> Monochrome B&W
              </div>
            </div>
          )}
        </div>

        {/* Capture details badge */}
        {captured && (
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`,
            padding: '8px 16px',
            borderRadius: 12,
            fontSize: 11.5,
          }}>
            <div>
              <span style={{ color: C.muted }}>Exact Time: </span>
              <strong style={{ color: C.text }}>{fmtTime(captured.timestamp)}</strong>
            </div>
            <div style={{ width: 1, height: 14, background: C.border }} />
            <div>
              <span style={{ color: C.muted }}>Capacity: </span>
              <strong style={{ color: C.green }}>{captured.sizeKb} KB</strong>
            </div>
          </div>
        )}

        {/* Actions Button Bar */}
        <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!captured ? (
            <>
              {stream && (
                <ERPBtn
                  variant={isCheckIn ? 'primary' : 'success'}
                  disabled={processing}
                  onClick={handleCapture}
                  style={{ flex: 1, justifyContent: 'center', padding: '12px 18px', fontSize: 13 }}
                >
                  <Camera size={16} /> {processing ? 'Optimizing…' : 'Take Selfie'}
                </ERPBtn>
              )}

              {stream && (
                <ERPBtn
                  variant="secondary"
                  onClick={toggleFacingMode}
                  title="Flip camera"
                  style={{ padding: '12px' }}
                >
                  <RefreshCw size={15} />
                </ERPBtn>
              )}

              {/* Device camera fallback upload button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <ERPBtn
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
                style={{ fontSize: 11, padding: '10px 14px' }}
              >
                <Upload size={13} /> Upload / Phone Camera
              </ERPBtn>
            </>
          ) : (
            <>
              <ERPBtn
                variant="secondary"
                onClick={handleRetake}
                style={{ flex: 1, justifyContent: 'center', padding: '12px' }}
              >
                <RefreshCw size={14} /> Retake
              </ERPBtn>
              <ERPBtn
                variant={isCheckIn ? 'primary' : 'success'}
                onClick={handleConfirm}
                style={{ flex: 2, justifyContent: 'center', padding: '12px', fontSize: 13 }}
              >
                <Check size={16} /> Confirm & {isCheckIn ? 'Check In' : 'Check Out'}
              </ERPBtn>
            </>
          )}
        </div>

        <div style={{ fontSize: 10, color: C.muted, textAlign: 'center', lineHeight: 1.5 }}>
          The selfie is converted to black & white (monochrome) and compressed to lightweight KB.
          The exact photo upload time automatically sets your {isCheckIn ? 'check-in' : 'check-out'} time.
        </div>
      </div>
    </ERPModal>
  );
}
