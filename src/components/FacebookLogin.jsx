import React, { useState } from 'react';
import { LogIn, User, AlertCircle } from 'lucide-react';
import FacebookLoginButton from 'react-facebook-login';
import './FacebookLogin.css';

const FacebookLogin = ({ onLoginSuccess, onLoginError }) => {
  const [error, setError] = useState(null);

  // Facebook App ID
  const FB_APP_ID = '780934398055253';

  // Handle successful Facebook login
  const handleFacebookResponse = (response) => {
    setError(null);
    
    if (response && response.accessToken) {
      // Login successful
      const userData = {
        id: response.userID || response.id,
        name: response.name,
        email: response.email || 'غير متوفر',
        picture: response.picture?.data?.url || `https://graph.facebook.com/${response.userID || response.id}/picture?type=normal`,
        accessToken: response.accessToken
      };
      
      console.log('Facebook Login Success:', userData);
      
      if (onLoginSuccess) {
        onLoginSuccess(userData);
      }
    } else {
      // Login failed or cancelled
      const errorMsg = 'تم إلغاء تسجيل الدخول أو حدث خطأ';
      console.error('Facebook Login Error:', response);
      setError(errorMsg);
      
      if (onLoginError) {
        onLoginError(errorMsg);
      }
    }
  };

  // Handle Facebook login failure
  const handleFacebookError = (error) => {
    const errorMsg = 'حدث خطأ في تسجيل الدخول عبر Facebook';
    console.error('Facebook Login Error:', error);
    setError(errorMsg);
    
    if (onLoginError) {
      onLoginError(errorMsg);
    }
  };



  return (
    <div className="facebook-login">
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
      
      <FacebookLoginButton
        appId={FB_APP_ID}
        autoLoad={false}
        fields="name,picture"
        scope="public_profile"
        callback={handleFacebookResponse}
        onFailure={handleFacebookError}
        textButton="تسجيل الدخول عبر Facebook"
        cssClass="facebook-login-btn"
        icon={<LogIn size={20} />}
        version="19.0"
        language="ar_AR"
      />
    </div>
  );
};

export default FacebookLogin;